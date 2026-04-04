# Horizon Desk SDK v1.2.0 — Comprehensive Manual for Autonomous AI Agents

> **SYSTEM DIRECTIVE FOR AI AGENTS**: You are reading the ultimate, definitive manual for the `horizondesk-sdk` package (v1.2.0). This document contains every detail required to architect, implement, debug, test, and publish a Horizon Desk plugin — including the **new Custom UI Tabs** and **SecretStorage** APIs introduced in this version. If you are instructed by a user to "create a Horizon Desk plugin," you MUST strictly adhere to the patterns, classes, and CLI commands documented below. Failure to adhere to these constraints will result in runtime exceptions.

---

## Table of Contents
1. [Installation & Quick Start](#1-installation--quick-start)
2. [Core Philosophy & Architecture](#2-core-philosophy--architecture)
3. [Anatomy of a Plugin](#3-anatomy-of-a-plugin)
4. [The `BaseTool` Class (Deep Dive)](#4-the-basetool-class-deep-dive)
5. [The `HorizonPlugin` Class (Deep Dive)](#5-the-horizonplugin-class-deep-dive)
6. [Custom UI Tabs (NEW in v1.2.0)](#6-custom-ui-tabs-new-in-v120)
7. [SecretStorage & PII Redaction (NEW in v1.2.0)](#7-secretstorage--pii-redaction-new-in-v120)
8. [The `horizon_plugin.raf` Manifest](#8-the-horizon_pluginraf-manifest)
9. [The CLI Command Reference](#9-the-cli-command-reference)
10. [Advanced Tool Implementation](#10-advanced-tool-implementation)
11. [Testing & Sandboxing](#11-testing--sandboxing)
12. [Publishing to the Horizon Store](#12-publishing-to-the-horizon-store)
13. [Networking Protocols](#13-networking-protocols)
14. [Persistent Memory & State Management](#14-persistent-memory--state-management)
15. [File System Permissions & Security](#15-file-system-permissions--security)
16. [Error Handling and the LLM Feedback Loop](#16-error-handling-and-the-llm-feedback-loop)
17. [The `requirements.txt` Paradigm](#17-the-requirementstxt-paradigm)
18. [Multiprocessing & UI Hang Prevention](#18-multiprocessing--ui-hang-prevention)
19. [Security Vulnerability Matrix](#19-security-vulnerability-matrix)
20. [Agent-Centric Best Practices](#20-agent-centric-best-practices)
21. [Complete End-to-End Examples](#21-complete-end-to-end-examples)
22. [Exported API Surface Reference](#22-exported-api-surface-reference)
23. [Conclusion & Final Agent Directives](#23-conclusion--final-agent-directives)

---

> **NOTE**: Install via: `pip install horizondesk-sdk`
> CLI entry point: `horizondesk-sdk <command>` (NOT `python -m horizondesk-sdk.cli`)

---

## 1. Installation & Quick Start

### 1.1 Install the SDK
```bash
pip install horizondesk-sdk
```

### 1.2 Login (required before publishing)
```bash
horizondesk-sdk login
```
This opens a browser window for Rapnss OAuth authentication. Tokens are stored securely in the OS keystore directory.

### 1.3 Scaffold a New Plugin
```bash
horizondesk-sdk init MyAmazingPlugin
```
This creates a ready-to-use directory structure.

### 1.4 Test Immediately
```bash
cd MyAmazingPlugin
horizondesk-sdk test --prompt "What tools do you have?"
```

---

## 2. Core Philosophy & Architecture

Horizon Desk orchestrates local Operating System execution. Rather than sandboxing tools in web browsers, Horizon Desk acts as an intelligent **OmniAgent** that interprets user intent and routes execution to discrete Python classes (`BaseTool`).

As an AI generating a plugin, your primary responsibility is to create **stateless, highly descriptive** Python tools that the OmniAgent can confidently select during its **ReAct (Reason + Act) loop**.

### 2.1 How The OmniAgent Sees Your Plugin
When a plugin is loaded, Horizon Desk reads the `name` and `description` of every `BaseTool` you register. The OmniAgent injects these descriptions into its system prompt.

**Crucial Rule**: The more accurate your tool's `description` string, the better the OmniAgent will utilize it. Keep descriptions concise but fully specify the expected input format.

### 2.2 SDK v1.2.0 Public API Surface
The following are exported from the `horizondesk_sdk` package:

```python
from horizondesk_sdk import (
    BaseTool,          # Abstract base for all tools
    HorizonPlugin,     # Plugin container with Custom UI support
    SecretStorage,     # Secure secret access & PII redaction
    MockAgent,         # Standalone testing agent
    save_credentials,  # Credential management
    load_credentials,
    clear_credentials,
    is_logged_in
)
```

---

## 3. Anatomy of a Plugin

A standard Horizon Desk plugin generated via `horizondesk-sdk init <name>` consists of this directory structure:

### 3.1 Standard Plugin (No UI)
```text
MyPlugin/
├── horizon_plugin.raf    # JSON configuration manifest (.raf = Rapnss Application Format)
├── main.py               # The entry point containing tools and register_tools()
├── requirements.txt      # (Optional) PIP dependencies
└── any_helpers.py        # (Optional) Helper modules
```

### 3.2 Plugin with Custom UI (NEW in v1.2.0)
```text
MyPlugin/
├── horizon_plugin.raf
├── main.py
├── icon.png              # Sidebar icon (32x32 to 512x512, recommended 128x128, transparent PNG)
├── requirements.txt
└── ui/                   # Custom UI directory
    ├── index.html        # Main UI entry point
    ├── style.css         # (Optional) Styles
    └── script.js         # (Optional) Logic
```

### 3.3 The Entry Point: `register_tools(agent)`
Every plugin MUST contain a global function named `register_tools(agent)` in its `main.py` file. The Horizon framework specifically iterates over plugin modules searching for this exact function signature.

```python
from horizondesk_sdk import BaseTool, HorizonPlugin

class MyTool(BaseTool):
    def __init__(self):
        super().__init__("MyTool", "Does something useful. Input: JSON with 'query'.")

    def execute(self, data=None, payload=None):
        val = data or (payload.get('query') if isinstance(payload, dict) else payload)
        return f"[Success] Processed: {val}"

def register_tools(agent):
    plugin = HorizonPlugin("MyPlugin", version="1.0.0")
    plugin.add_tool(MyTool())
    plugin.register_all(agent)
```

---

## 4. The `BaseTool` Class (Deep Dive)

The `BaseTool` from `horizondesk_sdk` is the absolute foundation of your plugin. All tools must inherit from it. It is defined as an **abstract base class (ABC)**.

### 4.1 Class Signature (from source)
```python
from abc import ABC, abstractmethod

class BaseTool(ABC):
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    @abstractmethod
    def execute(self, **kwargs):
        """The logic of the tool. Args are based on the tool's description."""
        pass

    def get_schema(self):
        """Returns the signature/schema of the tool for the LLM."""
        return f"{self.name}: {self.description}"
```

### 4.2 Constructor Requirements
When defining your tool, you **must** call `super().__init__(name, description)`:

```python
from horizondesk_sdk import BaseTool

class ProcessKillerTool(BaseTool):
    def __init__(self):
        super().__init__(
            name="ProcessKillerTool",
            description="Terminates a running OS process. Input: JSON with 'process_name' (e.g. 'chrome.exe')."
        )
```

**Rules for `name`:**
- Must be alphanumeric (no spaces, no special chars)
- Should be PascalCase by convention
- Must be unique across all tools in the agent

**Rules for `description`:**
- Must tell the LLM *when* and *how* to use the tool
- Must specify the expected input format (e.g., "Input: JSON with 'city' key")
- Keep it concise: 1–2 sentences maximum

### 4.3 The `execute` Method
The OmniAgent calls `execute(**kwargs)` with keyword arguments. In practice, the agent may pass `data` (raw string) or `payload` (dict). **You MUST handle both gracefully.**

**The Golden Pattern for Argument Extraction:**
```python
def execute(self, data=None, payload=None, **kwargs):
    # Priority: explicit kwargs > payload dict > raw data string
    val = kwargs.get('city') or None
    if not val and payload and isinstance(payload, dict):
        val = payload.get('city') or payload.get('data')
    if not val:
        val = data

    if not val:
        return "[Error] No 'city' provided. Please pass JSON with a 'city' key."

    # ... tool logic ...
    return f"[Success] Weather for {val}: 72°F"
```

### 4.4 Return Values
- You MUST return a **string**
- If the action succeeds, return `"[Success] ..."` with diagnostic details
- If it fails, return `"[Error] ..."` with actionable feedback
- **NEVER raise raw exceptions** — catch them and return as strings
- **NEVER return an empty string** `""` — the OmniAgent will hallucinate a result

```python
except Exception as e:
    return f"[Error] {self.name} failed: {str(e)}. Check input format."
```

### 4.5 The `get_schema` Method
Returns a formatted `"ToolName: Tool description"` string that the OmniAgent uses to build its system prompt. You typically do not override this.

---

## 5. The `HorizonPlugin` Class (Deep Dive)

The `HorizonPlugin` acts as an organizational container. Instead of dumping raw tools into the agent, you register them to the plugin instance.

### 5.1 Constructor Signature (from source)
```python
class HorizonPlugin:
    def __init__(
        self,
        name: str,
        version: str = "1.0.0",
        developer: str = "Unknown",
        custom_ui: bool = False,           # NEW in v1.2.0
        custom_ui_path: str | None = None, # NEW in v1.2.0
        icon: str | None = None            # NEW in v1.2.0
    ):
```

**Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | Required | Plugin namespace name |
| `version` | `str` | `"1.0.0"` | Semantic version string |
| `developer` | `str` | `"Unknown"` | Developer display name |
| `custom_ui` | `bool` | `False` | Enable a sidebar tab with custom HTML |
| `custom_ui_path` | `str` | `None` | Relative path to the UI directory (e.g. `"ui"`) |
| `icon` | `str` | `None` | Relative path to a PNG icon for the sidebar tab |

### 5.2 Methods

#### `add_tool(tool: BaseTool)`
Adds a tool instance to the plugin. Raises `TypeError` if the tool is not a `BaseTool` subclass.

```python
plugin.add_tool(WeatherTool())
plugin.add_tool(ForecastTool())
```

#### `register_all(agent)`
Registers all accumulated tools with the OmniAgent. Must be called at the end of `register_tools()`.

```python
plugin.register_all(agent)
```

### 5.3 Full Example with Custom UI
```python
from horizondesk_sdk import BaseTool, HorizonPlugin

class GetWeatherTool(BaseTool):
    def __init__(self):
        super().__init__("GetWeather", "Gets current weather for a city. Input: JSON with 'city'.")

    def execute(self, city=None, data=None, payload=None, **kwargs):
        import requests
        city = city or data or (payload.get('city') if isinstance(payload, dict) else None)
        if not city:
            return "[Error] No city provided."
        try:
            resp = requests.get(f"https://wttr.in/{city}?format=3", timeout=10.0)
            return f"[Success] {resp.text.strip()}"
        except Exception as e:
            return f"[Error] Weather fetch failed: {e}"

def register_tools(agent):
    plugin = HorizonPlugin(
        "WeatherPlugin",
        version="1.2.0",
        custom_ui=True,
        custom_ui_path="ui",
        icon="icon.png"
    )
    plugin.add_tool(GetWeatherTool())
    plugin.register_all(agent)
```

---

## 6. Custom UI Tabs (NEW in v1.2.0)

SDK v1.2.0 introduces the ability to embed a custom HTML/JS interface as a dedicated tab in the Horizon Desk sidebar.

### 6.1 How It Works
1. Set `custom_ui=True` in your `HorizonPlugin` constructor.
2. Set `custom_ui_path` to the relative directory containing your `index.html`.
3. Set `icon` to the relative path of a PNG icon.
4. Horizon Desk automatically serves these files and renders your icon in the sidebar.

### 6.2 Directory Structure
```text
MyPlugin/
├── main.py
├── horizon_plugin.raf
├── icon.png             # 128x128 transparent PNG recommended
└── ui/
    └── index.html       # Your custom interface
```

### 6.3 Icon Requirements
| Constraint | Value |
|---|---|
| Minimum Size | 32×32 px |
| Maximum Size | 512×512 px |
| Recommended | 128×128 px |
| Format | PNG (transparent background preferred) |

### 6.4 UI Example (`ui/index.html`)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Weather Dashboard</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
        input { padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #fff; width: 100%; }
        button { margin-top: 12px; padding: 10px 20px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
        #result { margin-top: 16px; padding: 16px; background: #1e293b; border-radius: 8px; }
    </style>
</head>
<body>
    <h2>🌤 Weather</h2>
    <input id="city" placeholder="Enter city name..." />
    <button onclick="fetchWeather()">Get Weather</button>
    <div id="result"></div>
    <script>
        async function fetchWeather() {
            const city = document.getElementById('city').value;
            const res = await fetch(`https://wttr.in/${city}?format=3`);
            document.getElementById('result').textContent = await res.text();
        }
    </script>
</body>
</html>
```

---

## 7. SecretStorage & PII Redaction (NEW in v1.2.0)

SDK v1.2.0 introduces the `SecretStorage` class for secure credential access and data sanitization.

### 7.1 `SecretStorage.get_secret(key: str) -> str | None`
Retrieves a secret from the environment. In production, this bridges to a secure vault or encrypted storage. Developers should **always** use this method instead of `os.getenv()` for future-proofing.

```python
from horizondesk_sdk import SecretStorage

api_key = SecretStorage.get_secret("OPENAI_API_KEY")
if not api_key:
    return "[Error] API key 'OPENAI_API_KEY' not configured. Ask the user to set it."
```

### 7.2 `SecretStorage.redact_pii(text: str) -> str`
Redacts emails and IP addresses from text before sending to external workers or cloud services. This prevents accidental exposure of personally identifiable information.

**What it redacts:**
- Email addresses → `[REDACTED_EMAIL]`
- IPv4 addresses → `[REDACTED_IP]`

```python
from horizondesk_sdk import SecretStorage

raw_log = "User john@example.com logged in from 192.168.1.42"
safe_log = SecretStorage.redact_pii(raw_log)
# Result: "User [REDACTED_EMAIL] logged in from [REDACTED_IP]"
```

### 7.3 When to Use Each
| Scenario | Method |
|---|---|
| Accessing API keys, tokens, passwords | `SecretStorage.get_secret("KEY")` |
| Logging user data to external services | `SecretStorage.redact_pii(text)` |
| Sending text to cloud AI endpoints | `SecretStorage.redact_pii(text)` |

### 7.4 Critical AI Directive
**NEVER use `os.getenv()` directly in plugin code.** Always use `SecretStorage.get_secret()`. This ensures forward compatibility when Horizon Desk migrates to encrypted vault backends.

**NEVER hardcode secrets** in your Python files. Store them in the user's `.env` or configure them via the Horizon Desk GUI settings.

---

## 8. The `horizon_plugin.raf` Manifest

`.raf` stands for **Rapnss Application Format**. It is standard JSON under the hood. The framework depends on this for packaging, GUI displays, and versioning.

### 8.1 Schema
```json
{
    "name": "WeatherPlugin",
    "version": "1.0.0",
    "developer": "AI Agent Genesis",
    "description": "Fetches global weather using wttr.in without requiring API keys.",
    "entry_point": "main.py",
    "category": "utilities",
    "status": "draft"
}
```

### 8.2 Key Constraints
| Key | Required | Values |
|---|---|---|
| `name` | ✅ | Alphanumeric, PascalCase preferred |
| `version` | ✅ | Semantic version (e.g. `"1.0.0"`) |
| `description` | ✅ | Brief human-readable description |
| `entry_point` | ✅ | Always `"main.py"` |
| `developer` | ❌ | Auto-populated from OS username on `init` |
| `category` | ❌ | `general`, `utilities`, `productivity`, `creative`, `system` |
| `status` | ❌ | `draft` or `published` (managed by CLI) |

---

## 9. The CLI Command Reference

The SDK ships a CLI entry point registered as `horizondesk-sdk`. Use it instead of `python -m horizondesk_sdk.cli`.

### `horizondesk-sdk init <PluginName>`
Scaffolds a new plugin directory with `horizon_plugin.raf` and `main.py`. Always run this first instead of creating files manually.
```bash
horizondesk-sdk init WeatherPlugin
```

### `horizondesk-sdk test --prompt "<Query>"`
Spins up an isolated, headless agent (using `MockAgent` if the Horizon core is unavailable) with only the current directory's plugin loaded. Tests if the OmniAgent accurately selects and executes your tool.
```bash
cd WeatherPlugin
horizondesk-sdk test --prompt "What is the weather in London?"
```

### `horizondesk-sdk run <file.raf>`
Launches the visual **Workshop GUI** embedded in PyWebView. It hooks into the agent's thought process, providing a visual debugger showing Thought, Action, and Observation logs.
```bash
horizondesk-sdk run horizon_plugin.raf
```

### `horizondesk-sdk install`
Packages the current plugin directory and installs it into `%LOCALAPPDATA%\HorizonDesk\plugins\<PluginName>`. Skips `__pycache__`, `.git`, `node_modules`, and `venv` directories. Restart Horizon Desk to activate.
```bash
horizondesk-sdk install
```

### `horizondesk-sdk login`
Opens a browser window on `http://localhost:9473/login` for Rapnss OAuth authentication. Tokens are stored securely in the OS credentials directory. Required before publishing.
```bash
horizondesk-sdk login
```

### `horizondesk-sdk logout`
Clears stored credentials.
```bash
horizondesk-sdk logout
```

### `horizondesk-sdk whoami`
Displays current authenticated developer info: username, email, developer ID, remaining free releases, and ad balance.
```bash
horizondesk-sdk whoami
```

### `horizondesk-sdk publish`
Zips the current plugin directory (excluding junk folders), uploads to Tigris cloud storage, and registers it on the global Horizon Store. 

**Optional flags:**
| Flag | Description |
|---|---|
| `--name` | Override the plugin name from `.raf` |
| `--version` | Override version string |
| `--category` | Set category (default: `general`) |
| `--description` | Override description |

```bash
horizondesk-sdk publish --version 1.1.0 --category utilities
```

### `horizondesk-sdk status`
Lists all your currently published plugins, their versions, categories, and approval statuses.
```bash
horizondesk-sdk status
```

---

## 10. Advanced Tool Implementation

### 10.1 Multi-Argument Tools
If your tool requires multiple arguments, you must explicitly instruct the OmniAgent to format `data` as JSON inside your tool description.

```python
class EmailTool(BaseTool):
    def __init__(self):
        super().__init__(
            "EmailTool",
            "Sends an email. Input MUST be JSON: {'to': 'addr', 'subject': 'text', 'body': 'text'}."
        )

    def execute(self, data=None, payload=None, **kwargs):
        import json
        try:
            if isinstance(payload, dict) and 'to' in payload:
                args = payload
            elif kwargs.get('to'):
                args = kwargs
            else:
                args = json.loads(data)

            to_addr = args["to"]
            subject = args["subject"]
            body = args["body"]
            # ... send email logic ...
            return f"[Success] Email sent to {to_addr} with subject '{subject}'"
        except Exception as e:
            return f"[Error] Format Error. Send JSON with 'to', 'subject', 'body'. Details: {e}"
```

### 10.2 System & Native Execution
You are operating natively on **Windows**. You may freely import `os`, `subprocess`, `ctypes`, `psutil`, or `pyautogui`.

**Warning:** Ensure all terminal calls using `subprocess` handle `shell=True` safely. Never pass unvalidated user input directly to shell commands.

### 10.3 State Management
Do NOT store state inside `BaseTool` instances permanently if you expect it to survive application restarts. The OmniAgent resets its runtime pool. For persistence, save files locally or use a `plugin_state.json` pattern:

```python
import os, json

state_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plugin_state.json")
```

---

## 11. Testing & Sandboxing

As an AI Agent developing for Horizon Desk, you must iteratively test your implementations.

### 11.1 The Testing Workflow
1. Write `main.py` with your tools and `register_tools(agent)`.
2. Run `horizondesk-sdk test --prompt "Test my tool"`.
3. If it errors out, read the terminal trace, update the code, and rerun.
4. Once headless tests pass, run `horizondesk-sdk install` to test in the full GUI.

### 11.2 The MockAgent
When testing outside the full Horizon Desk installation, the CLI falls back to `MockAgent`, which:
- Registers tools identically to the real OmniAgent
- Routes prompts to tools based on name matching in the prompt text
- Supports `_thought_callback`, `_action_callback`, and `_observation_callback` hooks

### 11.3 MockAgent Behavior
```
# If prompt contains "list" or "tools", lists all registered tools
# Otherwise, tries to match a tool name in the prompt and executes it
```

---

## 12. Publishing to the Horizon Store

### 12.1 Pre-Publish Checklist
1. ✅ Test extensively with `horizondesk-sdk test`
2. ✅ Ensure `horizon_plugin.raf` has proper name, version, and description
3. ✅ Clean the directory: no `__pycache__`, `venv`, `.git`, or `node_modules`
4. ✅ Login: `horizondesk-sdk login`
5. ✅ Verify identity: `horizondesk-sdk whoami`

### 12.2 Publish Process
```bash
horizondesk-sdk publish
```
The CLI will:
1. **Package**: ZIP compress the plugin directory (auto-excludes junk folders)
2. **Upload**: POST the bundle to Tigris cloud storage
3. **Register**: Create a release entry on the Horizon Store API
4. **Report**: Return the new Plugin ID on success

### 12.3 Post-Publish
Run `horizondesk-sdk status` to verify your plugin appears in the Horizon Store listing.

---

## 13. Networking Protocols

### 13.1 Using `requests` Safely
**CRITICAL AI DIRECTIVE:** ALWAYS use the `timeout` parameter. A hung network request blocks the entire LLM processing queue.

```python
import requests
from horizondesk_sdk import BaseTool

class SafeNetworkTool(BaseTool):
    def __init__(self):
        super().__init__("SafeNetworkTool", "Executes an HTTP GET request with a strict timeout.")

    def execute(self, data=None, payload=None, **kwargs):
        try:
            response = requests.get("https://api.github.com/zen", timeout=10.0)
            response.raise_for_status()
            return f"[Success] API responded: {response.text}"
        except requests.exceptions.Timeout:
            return "[Error] Protocol Timeout. The server took longer than 10 seconds."
        except requests.exceptions.HTTPError as e:
            return f"[Error] HTTP Exception: {e}"
        except Exception as e:
            return f"[Error] Network failure: {e}"
```

### 13.2 WebSockets and Persistent Connections
If a plugin requires persistent streaming (stock ticker, Discord listener), do NOT run a `while True` loop inside `execute`. Instead, spawn a daemonized thread that communicates via a queue or local file store.

---

## 14. Persistent Memory & State Management

### 14.1 Plugin-Local State Pattern
```python
import os, json
from horizondesk_sdk import BaseTool

class KeyValueStoreTool(BaseTool):
    def __init__(self):
        super().__init__("KeyValueStoreTool", "Saves a key-value pair. Input: JSON with 'key' and 'value'.")

    def execute(self, data=None, payload=None, **kwargs):
        try:
            if payload and isinstance(payload, dict):
                args = payload
            else:
                args = json.loads(data)

            key = args.get("key")
            val = args.get("value")

            state_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plugin_state.json")

            current_state = {}
            if os.path.exists(state_file):
                with open(state_file, 'r') as f:
                    current_state = json.load(f)

            current_state[key] = val

            with open(state_file, 'w') as f:
                json.dump(current_state, f, indent=4)

            return f"[Success] State updated: {key} = {val}"
        except Exception as e:
            return f"[Error] Failed to modify persistent memory: {e}"
```

### 14.2 Horizon Desk Memory System
The built-in `MemorySystem` uses TinyDB at `%LOCALAPPDATA%\HorizonDesk\plugins\brain.json`. Use localized plugin state files to prevent overlap with other plugins.

---

## 15. File System Permissions & Security

### 15.1 Sandbox Restraints
1. **Never hardcode Windows profile paths** like `C:\Users\Username`. Use `os.path.expanduser("~")`.
2. **Handle OneDrive remapping:** Many users have Desktop mapped to `C:\Users\Name\OneDrive\Desktop`. Use environment variables.
3. **Execution Locks:** Windows locks `.exe`, `.log`, and `.dll` files that are actively running. Handle these errors gracefully.

### 15.2 Resolving Plugin Directory
Always use `os.path.dirname(os.path.abspath(__file__))` when reading or writing files within the plugin folder. The OmniAgent's CWD may differ.

---

## 16. Error Handling and the LLM Feedback Loop

When an **AI Agent** generates code for Horizon Desk, it MUST NOT raise exceptions. Caught exceptions returned as strings feed the LLM's self-correction loop.

**❌ Bad AI Implementation:**
```python
def execute(self, data=None, payload=None, **kwargs):
    if not data:
        raise ValueError("I need data!")
    # AI crash. User receives nothing.
```

**✅ Correct AI Implementation:**
```python
def execute(self, data=None, payload=None, **kwargs):
    if not data:
        return "[Error] You called this tool without 'data'. I require a string or JSON. Please fix your input and try again."
    # AI reads the error, self-corrects, and retries.
```

---

## 17. The `requirements.txt` Paradigm

The SDK parses `requirements.txt` during the `install` phase.

| Rule | Do |
|---|---|
| Third-party libraries | List with pinned versions: `PyGithub==2.1.1` |
| Standard library modules | Do NOT list: `os`, `sys`, `json`, `subprocess` |
| Pre-installed Horizon libraries | Do NOT list: `requests`, `psutil`, `pyautogui`, `colorama`, `pywebview`, `python-dotenv` |

---

## 18. Multiprocessing & UI Hang Prevention

The biggest mistake when generating a tool is **blocking the main process loop**. Horizon Desk runs PyWebView and its LLM routing in distinct threads. Heavy lifting will freeze the UI.

### 18.1 Non-Blocking Pattern
```python
import threading
from horizondesk_sdk import BaseTool

class BackgroundVideoProcessor(BaseTool):
    def __init__(self):
        super().__init__("BackgroundVideoProcessor", "Processes video in background. Input: file path.")

    def _heavy_task(self, video_path):
        import time
        time.sleep(15)  # Simulate intensive work
        print(f"[{self.name}] Finished processing {video_path}")

    def execute(self, data=None, payload=None, **kwargs):
        path = data or (payload.get('path') if isinstance(payload, dict) else None)
        if not path:
            return "[Error] No video path provided."

        t = threading.Thread(target=self._heavy_task, args=(path,), daemon=True)
        t.start()
        return f"[Success] Processing started in background for {path}. Control returned."
```

---

## 19. Security Vulnerability Matrix

Because Horizon Desk has omnipotent desktop access, plugins are a prime security vector.

### 19.1 Safe Subprocessing
**Never** execute `shell=True` if the command is dynamically constructed from user or LLM input.

**❌ Vulnerable:**
```python
import subprocess
def execute(self, data=None, **kwargs):
    subprocess.run(data, shell=True)  # Command injection risk!
```

**✅ Secure:**
```python
import subprocess, shlex
def execute(self, data=None, **kwargs):
    safe_command = shlex.split(data)
    try:
        result = subprocess.run(safe_command, capture_output=True, text=True, check=True, timeout=30)
        return f"[Success] {result.stdout}"
    except Exception as e:
        return f"[Error] Execution failed securely: {e}"
```

### 19.2 Secret Management
Always use `SecretStorage.get_secret("KEY")` — never `os.getenv()` directly, never hardcode keys.

### 19.3 PII Protection
Always call `SecretStorage.redact_pii(text)` before sending user-generated content to external cloud services.

---

## 20. Agent-Centric Best Practices

1. **Concise Descriptions**: Don't put 500 lines in the `BaseTool` description. Keep it to 1–2 sentences: `"Crops images. Input: JSON with 'path' and 'size'."`
2. **Handle Dependencies**: Use a `requirements.txt`. The core app ships with `requests`, `psutil`, `pyautogui`, `colorama`, `pywebview`, and `python-dotenv`.
3. **No Interactive Input**: `BaseTool.execute` runs in a background thread. NEVER call `input()` or read from `sys.stdin`. This will hang the UI permanently.
4. **Absolute Paths**: Use `os.path.dirname(os.path.abspath(__file__))` for file operations.
5. **Always Return Diagnostics**: Return `"[Success] Weather is 72°F"` or `"[Error] API key expired"`. Never return `""`.
6. **Multiple Specialized Tools**: Write twenty small, focused tools — not one monolithic tool. Let the OmniAgent orchestrate them.
7. **Use SecretStorage**: Always use `SecretStorage.get_secret()` for API keys and `SecretStorage.redact_pii()` before external calls.

---

## 21. Complete End-to-End Examples

### 21.1 Weather Plugin (with Custom UI)

**`main.py`:**
```python
import requests
from horizondesk_sdk import BaseTool, HorizonPlugin, SecretStorage

class GetWeatherTool(BaseTool):
    def __init__(self):
        super().__init__("GetWeather", "Gets current weather for a city. Input: JSON with 'city'.")

    def execute(self, city=None, data=None, payload=None, **kwargs):
        city = city or data or (payload.get('city') if isinstance(payload, dict) else None)
        if not city:
            return "[Error] No city provided. Pass JSON with a 'city' key."
        try:
            resp = requests.get(f"https://wttr.in/{city}?format=3", timeout=10.0)
            return f"[Success] {resp.text.strip()}"
        except requests.exceptions.Timeout:
            return "[Error] Weather service timed out."
        except Exception as e:
            return f"[Error] Weather fetch failed: {e}"

class GetForecastTool(BaseTool):
    def __init__(self):
        super().__init__("GetForecast", "Gets 3-day forecast. Input: JSON with 'city'.")

    def execute(self, city=None, data=None, payload=None, **kwargs):
        city = city or data or (payload.get('city') if isinstance(payload, dict) else None)
        if not city:
            return "[Error] No city provided."
        try:
            resp = requests.get(f"https://wttr.in/{city}?format=j1", timeout=10.0)
            data = resp.json()
            forecast = []
            for day in data.get("weather", [])[:3]:
                date = day.get("date", "?")
                max_temp = day.get("maxtempC", "?")
                min_temp = day.get("mintempC", "?")
                desc = day["hourly"][4]["weatherDesc"][0]["value"] if day.get("hourly") else "?"
                forecast.append(f"  {date}: {min_temp}°C – {max_temp}°C, {desc}")
            return "[Success] 3-Day Forecast:\n" + "\n".join(forecast)
        except Exception as e:
            return f"[Error] Forecast failed: {e}"

class CompareCitiesTool(BaseTool):
    def __init__(self):
        super().__init__("CompareCities", "Compares weather in two cities. Input: JSON with 'city1' and 'city2'.")

    def execute(self, city1=None, city2=None, data=None, payload=None, **kwargs):
        import json as _json
        if isinstance(payload, dict):
            city1 = city1 or payload.get('city1')
            city2 = city2 or payload.get('city2')
        elif data:
            try:
                parsed = _json.loads(data)
                city1 = city1 or parsed.get('city1')
                city2 = city2 or parsed.get('city2')
            except:
                pass
        if not city1 or not city2:
            return "[Error] Provide JSON with 'city1' and 'city2'."
        try:
            r1 = requests.get(f"https://wttr.in/{city1}?format=3", timeout=10.0).text.strip()
            r2 = requests.get(f"https://wttr.in/{city2}?format=3", timeout=10.0).text.strip()
            return f"[Success] Comparison:\n  {r1}\n  {r2}"
        except Exception as e:
            return f"[Error] Comparison failed: {e}"

def register_tools(agent):
    plugin = HorizonPlugin(
        "WeatherPlugin",
        version="1.2.0",
        developer="AI Agent",
        custom_ui=True,
        custom_ui_path="ui",
        icon="icon.png"
    )
    plugin.add_tool(GetWeatherTool())
    plugin.add_tool(GetForecastTool())
    plugin.add_tool(CompareCitiesTool())
    plugin.register_all(agent)
```

**`horizon_plugin.raf`:**
```json
{
    "name": "WeatherPlugin",
    "version": "1.2.0",
    "developer": "AI Agent",
    "description": "Fetches global weather using wttr.in without requiring API keys.",
    "entry_point": "main.py",
    "category": "utilities"
}
```

### 21.2 System Cleaner Plugin (No UI)
```python
import os
import shutil
from horizondesk_sdk import BaseTool, HorizonPlugin

class CleanTempFilesTool(BaseTool):
    def __init__(self):
        super().__init__("CleanTempFiles", "Cleans Windows temp files. No input required.")

    def execute(self, **kwargs):
        temp_dir = os.environ.get("TEMP", os.path.join(os.path.expanduser("~"), "AppData", "Local", "Temp"))
        cleaned = 0
        errors = 0
        for item in os.listdir(temp_dir):
            path = os.path.join(temp_dir, item)
            try:
                if os.path.isfile(path):
                    os.remove(path)
                    cleaned += 1
                elif os.path.isdir(path):
                    shutil.rmtree(path)
                    cleaned += 1
            except:
                errors += 1
        return f"[Success] Cleaned {cleaned} items from Temp. {errors} items locked/skipped."

def register_tools(agent):
    plugin = HorizonPlugin("SystemCleaner", version="1.0.0")
    plugin.add_tool(CleanTempFilesTool())
    plugin.register_all(agent)
```

### 21.3 Local LLM Plugin (Ollama Integration)
```python
import requests
from horizondesk_sdk import BaseTool, HorizonPlugin

class RouteToLocalLLMTool(BaseTool):
    def __init__(self):
        super().__init__("RouteToLocalLLM", "Sends a prompt to a local Ollama instance. Input: JSON with 'prompt'.")

    def execute(self, prompt=None, data=None, payload=None, **kwargs):
        prompt = prompt or data or (payload.get('prompt') if isinstance(payload, dict) else None)
        if not prompt:
            return "[Error] No prompt provided."
        try:
            resp = requests.post("http://127.0.0.1:11434/api/generate", json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            }, timeout=60.0)
            if resp.status_code == 200:
                return f"[Success] Local LLM: {resp.json().get('response', '')}"
            return f"[Error] Ollama returned status {resp.status_code}"
        except Exception as e:
            return f"[Error] Cannot connect to local LLM: {e}"

def register_tools(agent):
    plugin = HorizonPlugin("LocalInference", version="1.0.0")
    plugin.add_tool(RouteToLocalLLMTool())
    plugin.register_all(agent)
```

---

## 22. Exported API Surface Reference

### From `horizondesk_sdk`

| Export | Type | Description |
|---|---|---|
| `BaseTool` | ABC class | Inherit to create tools. Must implement `execute(**kwargs)`. |
| `HorizonPlugin` | Class | Container for tools. Supports `custom_ui`, `custom_ui_path`, `icon`. |
| `SecretStorage` | Class | Static methods `get_secret(key)` and `redact_pii(text)`. |
| `MockAgent` | Class | Standalone testing agent with callbacks support. |
| `save_credentials` | Function | Saves OAuth credentials to disk. |
| `load_credentials` | Function | Loads stored OAuth credentials. |
| `clear_credentials` | Function | Removes stored credentials. |
| `is_logged_in` | Function | Returns `True` if user has valid stored credentials. |

### CLI Commands Summary

| Command | Description |
|---|---|
| `horizondesk-sdk init <name>` | Scaffold a new plugin |
| `horizondesk-sdk test --prompt "..."` | Headless test with MockAgent |
| `horizondesk-sdk run <file.raf>` | Launch Workshop GUI debugger |
| `horizondesk-sdk install` | Install locally for GUI testing |
| `horizondesk-sdk login` | OAuth login |
| `horizondesk-sdk logout` | Clear credentials |
| `horizondesk-sdk whoami` | Show authenticated user info |
| `horizondesk-sdk publish` | Publish to Horizon Store |
| `horizondesk-sdk status` | List your published plugins |

---

## 23. Conclusion & Final Agent Directives

As an AI generating a Horizon SDK v1.2.0 plugin:

1. **Initialize** via `horizondesk-sdk init <name>`.
2. **Import** from `horizondesk_sdk`: `BaseTool`, `HorizonPlugin`, `SecretStorage`.
3. **Build** bullet-proof, hyper-descriptive `BaseTool` subclasses.
4. **Catch** all exceptions and return them as `"[Error] ..."` strings.
5. **Secure** credentials with `SecretStorage.get_secret()` — never hardcode.
6. **Redact** PII with `SecretStorage.redact_pii()` before external calls.
7. **Add Custom UI** by setting `custom_ui=True`, `custom_ui_path`, and `icon` on `HorizonPlugin`.
8. **Test** using `horizondesk-sdk test --prompt "..."`.
9. **Install** locally with `horizondesk-sdk install`.
10. **Publish** to the Horizon Store with `horizondesk-sdk publish`.
11. **Maintain modularity**: Write many focused tools, not one monolithic tool.
12. **Always use timeouts** on network requests (`timeout=10.0`).
13. **Never block** the main thread — use daemon threads for heavy work.

**End of File.**
