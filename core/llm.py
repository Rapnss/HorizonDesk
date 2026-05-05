import os
import time
import json
import requests
from colorama import Fore
from abc import ABC, abstractmethod

class BaseInferenceEngine(ABC):
    """
    Abstract base class for all inference engines.
    """
    @abstractmethod
    def generate(self, messages, system_prompt=None, **kwargs):
        pass

    def generate_stream(self, messages, system_prompt=None, **kwargs):
        """Stream tokens one-by-one. Default: yield full response as single chunk."""
        result = self.generate(messages, system_prompt=system_prompt, **kwargs)
        yield result

    def generate_with_tools(self, messages, tools_schema, system_prompt=None, **kwargs):
        """Native function calling. Default: returns None (not supported)."""
        return None

    def get_capabilities(self):
        """Return engine capability flags."""
        return {"streaming": False, "function_calling": False, "vision": False, "max_context": 6000}

class RapnssEngine(BaseInferenceEngine):
    """
    Default Rapnss Inference Engine using Cloudflare Workers-based AI Gateway.
    Includes multi-neuron failover.
    """
    def __init__(self, provider_config):
        self.gateway_urls = [
            os.getenv("CLOUDFLARE_AI_GATEWAY_URL", "https://ai.api-rapnss.workers.dev").rstrip("/"),
            "https://ai.aaravkushwaha2010.workers.dev",
            "https://ai.solitary-moon-1e9e.workers.dev"
        ]
        self.current_gateway_index = 0
        self.client_id = os.getenv("RAPNSS_CLIENT_ID")
        self.client_secret = os.getenv("RAPNSS_CLIENT_SECRET")
        self.user_id = os.getenv("USERNAME") or os.getenv("USER") or "anonymous"
        self.session = requests.Session()

    def generate(self, messages, system_prompt=None, **kwargs):
        payload = {
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 6000),
            "temperature": kwargs.get("temperature", 0.7),
            "top_p": kwargs.get("top_p", 1),
            "stop": kwargs.get("stop", ["Observation:"]),
        }
        
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            payload["messages"].insert(0, {"role": "system", "content": system_prompt})

        headers = {
            "Content-Type": "application/json",
            "X-User-Id": self.user_id,
        }
        if self.client_id: headers["X-Client-Id"] = self.client_id
        if self.client_secret: headers["X-Client-Secret"] = self.client_secret

        max_neurons = len(self.gateway_urls)
        for neuron_attempt in range(max_neurons):
            idx = (self.current_gateway_index + neuron_attempt) % max_neurons
            endpoint = self.gateway_urls[idx]
            
            for attempt in range(2):
                try:
                    response = self.session.post(endpoint, json=payload, headers=headers, timeout=60)
                    if response.status_code == 200:
                        self.current_gateway_index = idx 
                        return response.json().get("response", "")
                    elif response.status_code == 429:
                        break # Try next neuron
                    elif response.status_code >= 400:
                        break # Try next neuron
                except:
                    break # Try next neuron
        return "Error: All Rapnss neurons exhausted."

class OpenAIEngine(BaseInferenceEngine):
    def __init__(self, api_key, model="gpt-4o"):
        self.api_key = api_key
        self.model = model

    def get_capabilities(self):
        return {"streaming": True, "function_calling": True, "vision": "gpt-4" in self.model, "max_context": 32000}

    def generate(self, messages, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7)
        }
        try:
            response = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            return f"Error OpenAI: {response.text}"
        except Exception as e:
            return f"Error OpenAI: {str(e)}"

    def generate_stream(self, messages, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": messages, "max_tokens": kwargs.get("max_tokens", 4096), "stream": True}
        try:
            response = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=60, stream=True)
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: ') and line != 'data: [DONE]':
                        try:
                            chunk = json.loads(line[6:])
                            delta = chunk['choices'][0].get('delta', {}).get('content', '')
                            if delta:
                                yield delta
                        except: pass
        except Exception as e:
            yield f"Error: {e}"

    def generate_with_tools(self, messages, tools_schema, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": messages, "tools": tools_schema, "max_tokens": kwargs.get("max_tokens", 4096)}
        try:
            response = requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                msg = response.json()['choices'][0]['message']
                if msg.get('tool_calls'):
                    tc = msg['tool_calls'][0]['function']
                    return {"tool_name": tc['name'], "tool_args": json.loads(tc.get('arguments', '{}')), "raw": msg.get('content', '')}
                return {"tool_name": None, "tool_args": {}, "raw": msg.get('content', '')}
            return None
        except:
            return None

class AnthropicEngine(BaseInferenceEngine):
    def __init__(self, api_key, model="claude-3-5-sonnet-20240620"):
        self.api_key = api_key
        self.model = model

    def get_capabilities(self):
        return {"streaming": True, "function_calling": True, "vision": True, "max_context": 32000}

    def generate(self, messages, system_prompt=None, **kwargs):
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        # Anthropic uses a separate field for system prompt
        payload = {
            "model": self.model,
            "messages": [m for m in messages if m['role'] != 'system'],
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7)
        }
        sys_msg = next((m['content'] for m in messages if m['role'] == 'system'), system_prompt)
        if sys_msg:
            payload["system"] = sys_msg

        try:
            response = requests.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['content'][0]['text']
            return f"Error Anthropic: {response.text}"
        except Exception as e:
            return f"Error Anthropic: {str(e)}"

class GoogleEngine(BaseInferenceEngine):
    def __init__(self, api_key, model="gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model

    def get_capabilities(self):
        return {"streaming": True, "function_calling": True, "vision": True, "max_context": 32000}

    def generate(self, messages, system_prompt=None, **kwargs):
        # Gemini API format is quite different
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        contents = []
        system_instruction = None
        
        for m in messages:
            if m['role'] == 'system':
                system_instruction = {"parts": [{"text": m['content']}]}
            else:
                role = "user" if m['role'] == 'user' else "model"
                contents.append({"role": role, "parts": [{"text": m['content']}]})

        if not system_instruction and system_prompt:
            system_instruction = {"parts": [{"text": system_prompt}]}

        payload = {"contents": contents}
        if system_instruction:
            payload["system_instruction"] = system_instruction

        try:
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
            if response.status_code == 200:
                res_data = response.json()
                if 'candidates' in res_data and res_data['candidates']:
                    return res_data['candidates'][0]['content']['parts'][0]['text']
                return f"Error Gemini: No candidates returned. Full response: {json.dumps(res_data)}"
            return f"Error Gemini: HTTP {response.status_code} - {response.text}"
        except Exception as e:
            return f"Error Gemini: {str(e)}"

class GroqEngine(BaseInferenceEngine):
    def __init__(self, api_key, model="llama3-70b-8192"):
        self.api_key = api_key
        self.model = model

    def get_capabilities(self):
        return {"streaming": True, "function_calling": False, "vision": False, "max_context": 6000}

    def generate(self, messages, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7)
        }
        try:
            response = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            return f"Error Groq: {response.text}"
        except Exception as e:
            return f"Error Groq: {str(e)}"

class OpenRouterEngine(BaseInferenceEngine):
    def __init__(self, api_key, model="auto"):
        self.api_key = api_key
        self.model = model

    def generate(self, messages, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://horizondesk.ai",
            "X-Title": "Horizon Desk"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
        }
        try:
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            return f"Error OpenRouter: {response.text}"
        except Exception as e:
            return f"Error OpenRouter: {str(e)}"

class XAIEngine(BaseInferenceEngine):
    def __init__(self, api_key, model="grok-2"):
        self.api_key = api_key
        self.model = model

    def generate(self, messages, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "stream": False
        }
        try:
            response = requests.post("https://api.x.ai/v1/chat/completions", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            return f"Error xAI: {response.text}"
        except Exception as e:
            return f"Error xAI: {str(e)}"

class OllamaEngine(BaseInferenceEngine):
    def __init__(self, base_url="http://localhost:11434", model="llama3"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def get_capabilities(self):
        return {"streaming": True, "function_calling": False, "vision": False, "max_context": 16000}

    def generate(self, messages, system_prompt=None, **kwargs):
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", 0.7),
                "num_predict": kwargs.get("max_tokens", 4096)
            }
        }
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            payload["messages"].insert(0, {"role": "system", "content": system_prompt})

        try:
            response = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=120)
            if response.status_code == 200:
                return response.json()['message']['content']
            return f"Error Ollama: {response.text}"
        except Exception as e:
            return f"Error Ollama: {str(e)}"

    def generate_stream(self, messages, system_prompt=None, **kwargs):
        payload = {
            "model": self.model, "messages": messages, "stream": True,
            "options": {"temperature": kwargs.get("temperature", 0.7)}
        }
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            payload["messages"].insert(0, {"role": "system", "content": system_prompt})
        try:
            response = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=120, stream=True)
            if response.status_code != 200:
                yield f"Error Ollama HTTP {response.status_code}: {response.text}"
                return
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    if 'error' in data:
                        yield f"Error Ollama: {data['error']}"
                        return
                    content = data.get('message', {}).get('content', '')
                    if content:
                        yield content
        except Exception as e:
            yield f"Error: {e}"

class CloudflareWorkersEngine(BaseInferenceEngine):
    def __init__(self, account_id, api_token, model="@cf/meta/llama-3-8b-instruct"):
        self.account_id = account_id
        self.api_token = api_token
        self.model = model

    def generate(self, messages, system_prompt=None, **kwargs):
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model}"
        headers = {"Authorization": f"Bearer {self.api_token}"}
        
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
            
        payload = {"messages": messages}
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['result']['response']
            return f"Error Cloudflare: {response.text}"
        except Exception as e:
            return f"Error Cloudflare: {str(e)}"

class UniversalInferenceEngine(BaseInferenceEngine):
    """
    World-class Universal Inference Engine.
    Can connect to any OpenAI-compatible API or custom endpoint.
    """
    def __init__(self, api_key, base_url, model):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def generate(self, messages, system_prompt=None, **kwargs):
        if system_prompt and not any(m['role'] == 'system' for m in messages):
            messages.insert(0, {"role": "system", "content": system_prompt})
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7)
        }
        try:
            url = f"{self.base_url}/chat/completions"
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            return f"Error Universal: {response.text}"
        except Exception as e:
            return f"Error Universal: {str(e)}"

class LLMProvider:
    def __init__(self, memory_system=None, agent=None):
        self.agent = agent
        if memory_system:
            self.mem_sys = memory_system
        else:
            from core.memory import MemorySystem
            self.mem_sys = MemorySystem()
        self.current_engine = None
        self.custom_engines = {} # plugin_name -> engine_instance
        self.engine_registry = {
            "rapnss": lambda: RapnssEngine({}),
            "openai": lambda: OpenAIEngine(self.mem_sys.get_setting("llm_openai_key"), self.mem_sys.get_setting("llm_openai_model", "gpt-4o")),
            "anthropic": lambda: AnthropicEngine(self.mem_sys.get_setting("llm_anthropic_key"), self.mem_sys.get_setting("llm_anthropic_model", "claude-3-5-sonnet-20240620")),
            "google": lambda: GoogleEngine(self.mem_sys.get_setting("llm_google_key"), self.mem_sys.get_setting("llm_google_model", "gemini-1.5-flash")),
            "groq": lambda: GroqEngine(self.mem_sys.get_setting("groqApiKey"), self.mem_sys.get_setting("llm_groq_model", "llama3-70b-8192")),
            "openrouter": lambda: OpenRouterEngine(self.mem_sys.get_setting("llm_openrouter_key"), self.mem_sys.get_setting("llm_openrouter_model", "auto")),
            "xai": lambda: XAIEngine(self.mem_sys.get_setting("llm_grok_key"), self.mem_sys.get_setting("llm_grok_model", "grok-2")),
            "ollama": lambda: OllamaEngine(self.mem_sys.get_setting("llm_ollama_url", "http://localhost:11434"), self.mem_sys.get_setting("llm_ollama_model", "llama3")),
            "cloudflare": lambda: CloudflareWorkersEngine(self.mem_sys.get_setting("llm_cloudflare_account_id"), self.mem_sys.get_setting("llm_cloudflare_api_token"), self.mem_sys.get_setting("llm_cloudflare_model", "@cf/meta/llama-3-8b-instruct")),
            "universal": lambda: UniversalInferenceEngine(
                self.mem_sys.get_setting("llm_universal_key"),
                self.mem_sys.get_setting("llm_universal_url", "https://api.openai.com/v1"),
                self.mem_sys.get_setting("llm_universal_model", "gpt-4o")
            )
        }
        self.log_callback = None
        self._refresh_engine()

    def _refresh_engine(self):
        provider = self.mem_sys.get_setting("llm_provider", "rapnss").lower()
        if provider == "rapnss" and getattr(self.agent, 'testing_mode', False):
            print(Fore.RED + "[LLM] Rapnss inference is RESTRICTED during plugin testing. Please use a different provider (OpenAI, Anthropic, etc.) or local inference.")
            # Fallback to the first non-rapnss engine available
            for p in self.engine_registry:
                if p != "rapnss":
                    provider = p
                    print(Fore.YELLOW + f"[LLM] Falling back to {provider} for testing.")
                    break
        
        if provider in self.engine_registry:
            try:
                self.current_engine = self.engine_registry[provider]()
            except Exception as e:
                print(Fore.RED + f"[LLM] Error initializing engine '{provider}': {e}")
                self.current_engine = RapnssEngine({})
        elif provider == "custom":
            plugin_name = self.mem_sys.get_setting("llm_custom_plugin")
            self.current_engine = self.custom_engines.get(plugin_name)
            if not self.current_engine:
                print(Fore.RED + f"[LLM] Custom engine for plugin '{plugin_name}' not registered. Falling back to Rapnss.")
                self.current_engine = RapnssEngine({})
        else:
            self.current_engine = RapnssEngine({})

    def register_custom_engine(self, name, engine_instance):
        self.custom_engines[name] = engine_instance
        print(Fore.GREEN + f"[LLM] Registered custom inference engine from plugin: {name}")

    def _estimate_tokens(self, text):
        """Rough token estimation: ~1 token per 4 characters."""
        return len(text) // 4

    def _truncate_prompt(self, prompt, system_prompt="", max_tokens=6000):
        """
        Truncate prompt to fit within token budget, accounting for system prompt.
        """
        sys_tokens = self._estimate_tokens(system_prompt)
        available_tokens = max_tokens - sys_tokens - 500 # Reserve 500 for generation
        
        if available_tokens < 1000:
            available_tokens = 1000 # Minimum floor
            
        estimated = self._estimate_tokens(prompt)
        if estimated <= available_tokens:
            return prompt

        # Truncate from the middle, keeping start and end for context
        char_limit = int(available_tokens * 3.5) # Safer char-to-token ratio
        half = char_limit // 2
        truncated = prompt[:half] + "\n\n... [TRUNCATED FOR TOKEN LIMIT] ...\n\n" + prompt[-half:]
        return truncated

    def get_capabilities(self):
        """Get current engine capabilities."""
        self._refresh_engine()
        if self.current_engine:
            return self.current_engine.get_capabilities()
        return {"streaming": False, "function_calling": False, "vision": False, "max_context": 6000}

    def generate_text(self, prompt, system_prompt="You are a helpful AI assistant.", stream=False):
        # Refresh configuration in case it changed via settings
        self._refresh_engine()
        
        # Determine model-specific token limit from engine capabilities
        caps = self.current_engine.get_capabilities() if self.current_engine else {}
        max_budget = caps.get("max_context", 6000)
        
        # --- CLIENT-SIDE RATE LIMITING ---
        request_count = self.mem_sys.get_recent_request_count(3600)
        if request_count >= 100:
            msg = f"Local Rate Limit Exceeded: You have performed {request_count} tasks in the last hour."
            return msg
        self.mem_sys.log_request()

        # Truncate prompt if it exceeds token budget
        truncated_prompt = self._truncate_prompt(prompt, system_prompt=system_prompt, max_tokens=max_budget)
        messages = [{"role": "user", "content": truncated_prompt}]
        
        try:
            if stream:
                return self.current_engine.generate_stream(messages, system_prompt=system_prompt)
            
            response = self.current_engine.generate(messages, system_prompt=system_prompt)
            return response
        except Exception as e:
            print(Fore.RED + f"[LLM Error] {e}")
            return f"Error: {str(e)}"

    def generate_stream(self, prompt, system_prompt="You are a helpful AI assistant."):
        """Helper for explicit streaming calls."""
        return self.generate_text(prompt, system_prompt=system_prompt, stream=True)

    def analyze_image(self, image_path, prompt="Describe this image"):
        # For now, vision is still routed to Rapnss or Cloudflare if capable.
        # This can be expanded similarly.
        return "[Vision capabilities are currently linked to Rapnss/Cloudflare provider]"

    def classify_image(self, image_path):
        """[v2.0] Short-hand for visual classification."""
        return self.analyze_image(image_path, prompt="Classify this image and list the main objects found.")
