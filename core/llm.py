import os
import time
import json
import requests
from colorama import Fore

class LLMProvider:
    def __init__(self):
        # Multi-Gateway "Neurons" (3 Accounts for Failover)
        self.gateway_urls = [
            os.getenv("CLOUDFLARE_AI_GATEWAY_URL", "https://ai.api-rapnss.workers.dev").rstrip("/"),
            "https://ai.aaravkushwaha2010.workers.dev",
            "https://ai.solitary-moon-1e9e.workers.dev"
        ]
        self.current_gateway_index = 0
        
        # Rapnss Credentials for the worker
        self.client_id = os.getenv("RAPNSS_CLIENT_ID")
        self.client_secret = os.getenv("RAPNSS_CLIENT_SECRET")
        self.user_id = os.getenv("USERNAME") or os.getenv("USER") or "anonymous"

        # Max token budget per request (Increased to 8000 as per latest worker config)
        self.MAX_TOKENS = 8000

        # Persistent session for performance (TCP/SSL Reuse)
        self.session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10)
        self.session.mount("https://", adapter)
        self.log_callback = None

    def _estimate_tokens(self, text):
        """Rough token estimation: ~1 token per 4 characters."""
        return len(text) // 4

    def _truncate_prompt(self, prompt, max_tokens=5500):
        """
        Truncate prompt to fit within token budget.
        Leaves headroom for the response (max_tokens - 3500 = ~500 for response).
        """
        estimated = self._estimate_tokens(prompt)
        if estimated <= max_tokens:
            return prompt

        # Truncate from the middle, keeping start and end for context
        char_limit = max_tokens * 4
        half = char_limit // 2
        truncated = prompt[:half] + "\n\n... [TRUNCATED FOR TOKEN LIMIT] ...\n\n" + prompt[-half:]
        print(Fore.YELLOW + f"[LLM] Prompt truncated from ~{estimated} to ~{max_tokens} tokens")
        return truncated

    def generate_text(self, prompt, system_prompt="You are a helpful AI assistant."):
        """
        Generates text by calling the Rapnss AI gateway.
        The worker handles model selection and fallbacks based on its internal defaults.
        """
        # --- CLIENT-SIDE RATE LIMITING ---
        from core.memory import MemorySystem
        mem_sys = MemorySystem()
        request_count = mem_sys.get_recent_request_count(3600)
        
        if request_count >= 100:
            msg = f"Local Rate Limit Exceeded: You have performed {request_count} tasks in the last hour. Please wait before starting a new one."
            print(Fore.RED + f"[LLM] {msg}")
            return msg
        
        # Log the request
        mem_sys.log_request()

        # Truncate prompt if it exceeds token budget
        prompt = self._truncate_prompt(prompt)

        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 6000,
            "temperature": 0.7,
            "top_p": 1,
            "stop": ["Observation:"],  # Stop before hallucinating tool results
        }

        # Log payload size for debugging timeout issues
        payload_size = len(json.dumps(payload))
        
        headers = {
            "Content-Type": "application/json",
            "X-User-Id": self.user_id,
        }
        if self.client_id: headers["X-Client-Id"] = self.client_id
        if self.client_secret: headers["X-Client-Secret"] = self.client_secret

        # Failover Strategy: Try each Neuron if the previous one fails
        max_neurons = len(self.gateway_urls)
        
        for neuron_attempt in range(max_neurons):
            # Calculate current neuron based on rotation
            idx = (self.current_gateway_index + neuron_attempt) % max_neurons
            endpoint = self.gateway_urls[idx]
            
            msg = f"[LLM Debug] Sending request to Neuron {idx+1}/{max_neurons}: {endpoint}"
            print(Fore.CYAN + msg)
            if self.log_callback: self.log_callback(msg)

            max_retries = 2 # Retries per Neuron
            for attempt in range(max_retries):
                try:
                    start_time = time.time()
                    response = self.session.post(
                        endpoint,
                        json=payload,
                        headers=headers,
                        timeout=60,
                    )
                    duration = time.time() - start_time
                    
                    if response.status_code == 200:
                        # Success! Keep this neuron for the next request
                        self.current_gateway_index = idx 
                        
                        msg = f"[LLM] Request successful ({duration:.1f}s)"
                        print(Fore.GREEN + msg)
                        if self.log_callback: self.log_callback(msg)
                        
                        data = response.json()
                        return data.get("response", "")

                    elif response.status_code == 429:
                        # Rate limited on this Neptune, try next one
                        print(Fore.YELLOW + f"[LLM] Neuron {idx+1} rate limited. Hopping to next...")
                        break # Break retry loop to try next Neptune

                    elif response.status_code == 400 or response.status_code >= 500:
                        # Critical error on this Neptune, try next one
                        data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                        err = data.get("error", f"HTTP {response.status_code}")
                        print(Fore.RED + f"[LLM Error] Neuron {idx+1} failed: {err}. Hopping...")
                        break # Break retry loop to try next Neptune

                except Exception as e:
                    print(Fore.YELLOW + f"[LLM] Connection to Neuron {idx+1} failed: {e}. Hopping...")
                    break # Break retry loop to try next Neptune

        print(Fore.RED + "[LLM Error] All AI Neurons exhausted. Please check your Cloudflare workers status.")
        return "Error: All AI gateways are currently offline or rate-limited."

    def analyze_image(self, image_path, prompt="Describe this image"):
        """
        Analyzes an image by sending it as base64 to the AI gateway.
        Uses the vision-capable model on Cloudflare Workers AI.
        """
        import base64

        try:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')

            print(Fore.CYAN + f"[Vision Debug] Encoded image size: {len(base64_image)} chars")

            payload = {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                },
                            },
                        ],
                    }
                ],
                "model": "@cf/meta/llama-3.2-11b-vision-instruct",
                "max_tokens": 6000,
            }

            headers = {
                "Content-Type": "application/json",
                "X-User-Id": self.user_id,
            }

            response = requests.post(
                self.chat_endpoint,
                json=payload,
                headers=headers,
                timeout=90,
            )

            if response.status_code == 200:
                data = response.json()
                print(Fore.GREEN + "[Vision Debug] Request successful.")
                return data.get("response", "No response from vision model.")
            else:
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                error = data.get("error", f"HTTP {response.status_code}")
                print(Fore.RED + f"[Vision Error] {error}")
                return f"Error in Vision Analysis: {error}"

        except Exception as e:
            print(Fore.RED + f"[Vision Error]: {e}")
            import traceback
            traceback.print_exc()
            return f"Error in Vision Analysis: {e}"

    def classify_image(self, image_path):
        """
        Sends an image to the /api/classify endpoint for ResNet-50 classification.
        Returns the raw JSON response (e.g., list of classes and scores).
        """
        try:
            with open(image_path, "rb") as image_file:
                # Read bytes and convert to list of integers? 
                # Or Cloudflare AI binding via REST might want base64?
                # The worker effectively receives the JSON body.
                # Let's try sending as list of integers (byte array) which is robust for Workers AI `image` input.
                image_bytes = list(image_file.read())

            payload = {
                "image": image_bytes
            }

            headers = {
                "Content-Type": "application/json",
                "X-User-Id": self.user_id,
            }
            
            # Use the /api/classify endpoint on the same gateway
            classify_endpoint = f"{self.gateway_url}/api/classify"

            print(Fore.CYAN + f"[Classify Debug] Sending {len(image_bytes)} bytes to {classify_endpoint}")

            response = requests.post(
                classify_endpoint,
                json=payload,
                headers=headers,
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                return data # specific format depends on ResNet50 output
            else:
                print(Fore.RED + f"[Classify Error] HTTP {response.status_code}: {response.text}")
                return {"error": f"HTTP {response.status_code}"}

        except Exception as e:
            print(Fore.RED + f"[Classify Error] {e}")
            return {"error": str(e)}
