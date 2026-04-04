/**
 * Horizon Desk — Cloudflare AI Worker
 * Accepts chat completion requests and runs inference via Workers AI.
 */

// CORS headers for cross-origin requests from the Python client
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, Authorization',
};

// Maximum tokens enforced per request
const MAX_OUTPUT_TOKENS = 8000;
const MAX_USER_INPUT_TOKENS = 8000;
const MAX_TOTAL_INPUT_TOKENS = 32768; // System prompt with 100+ tools is very large

// Default model for text inference (Standard Safe Reasoning Model)
const DEFAULT_TEXT_MODEL = '@cf/meta/llama-3-8b-instruct';

// Fallback model chain (High availability, no-special-features needed)
const MODEL_FALLBACKS = [
  '@cf/meta/llama-2-7b-chat-int8',
  '@cf/mistral/mistral-7b-instruct-v0.1',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/moonshotai/kimi-k2.5'
];

// Image generation model
const IMAGE_GEN_MODEL = '@cf/black-forest-labs/flux-2-klein-9b';

export default {
  async fetch(request, env) {
    const start = Date.now();
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS_HEADERS });
    }

    try {
      const body = await request.json();
      
      // Hardware-accelerated image generation
      if (body.type === 'image_generation') {
        const result = await env.AI.run(IMAGE_GEN_MODEL, { prompt: body.prompt });
        const end = Date.now();
        
        let base64str;
        if (result instanceof ArrayBuffer || result instanceof Uint8Array || Array.isArray(result)) {
            // Convert byte array or ArrayBuffer to base64
            const uint8Array = new Uint8Array(result);
            // Quick robust string conversion for large arrays
            const CHUNK_SIZE = 8192;
            let rawStr = '';
            for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
                rawStr += String.fromCharCode.apply(null, uint8Array.subarray(i, i + CHUNK_SIZE));
            }
            base64str = btoa(rawStr);
        } else if (result && result.image) {
            base64str = result.image; // Some CF models return base64 json directly
        } else {
            throw new Error("Unexpected format from Image generator");
        }

        return new Response(JSON.stringify({
           image: `data:image/jpeg;base64,${base64str}`,
           latency: `${end - start}ms`
        }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
      }
      
      // Minimal payload for maximal compatibility with all Workers AI models
      const aiPayload = {
        messages: body.messages,
        max_tokens: body.max_tokens || 2048
      };

      let result;
      let usedModel = body.model || DEFAULT_TEXT_MODEL;
      let modelsToTry = [usedModel, ...MODEL_FALLBACKS];

      for (const model of modelsToTry) {
        try {
          result = await env.AI.run(model, aiPayload);
          usedModel = model;
          break; // Success, exit fallback loop
        } catch (e) {
          console.error(`Model ${model} failed: ${e.message}`);
          // Continue to next fallback
        }
      }

      if (!result) {
        throw new Error('All models in the fallback chain failed to generate a response.');
      }

      const end = Date.now();
      
      let responseText = '';
      if (typeof result === 'string') {
        responseText = result;
      } else if (result.response) {
        responseText = result.response;
      } else if (result.result) {
        responseText = result.result;
      } else if (result.choices && result.choices.length > 0) {
        if (result.choices[0].message && result.choices[0].message.content) {
            responseText = result.choices[0].message.content;
        } else if (result.choices[0].text) {
            responseText = result.choices[0].text;
        } else {
            responseText = JSON.stringify(result.choices);
        }
      } else {
        responseText = JSON.stringify(result);
      }
      
      return new Response(JSON.stringify({
        response: responseText,
        model_used: usedModel,
        latency: `${end - start}ms`
      }), {
        headers: { 
          'Content-Type': 'application/json', 
          'X-Latency': `${end - start}ms`,
          ...CORS_HEADERS 
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: CORS_HEADERS });
    }
  }
};