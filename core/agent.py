import re
import json
import threading
import concurrent.futures
from colorama import Fore, Style
from .llm import LLMProvider
from .security.shilden import shilden
import re
import os

class Agent:
    def _broadcast_swarm_task(self, sub_task):
        """[v2.0] Broadcasts a sub-task to the Global Horizon Relay."""
        from core.horizon_online import get_client
        client = get_client()
        if not client.team_code:
            return None # Fallback to local execution
            
        print(Fore.MAGENTA + f"[Global Swarm] Broadcasting task: {sub_task[:50]}...")
        # Find a suitable member
        members = client.get_members()
        for m in members:
            if m['id'] != client.member_id and m['status'] == 'online':
                # Assign task to the first available online member
                res = client.assign_task(m['id'], sub_task)
                if res.get('success'):
                    return f"Task delegated to global team member {m['id']} ({m['role']}). Waiting for result..."
        return None

    def _execute_swarm(self, user_input):
        # Determine Swarm Mode from settings
        swarm_mode = self.memory_system.get_setting("swarm_mode", "local")
        
        # Parse the input into sub-tasks using the graph generator
        from core.task_graph import TaskGraphGenerator
        graph = TaskGraphGenerator(self).generate(user_input)
        
        results = []
        for task in graph:
            # 1. Try Global Swarm if enabled
            if swarm_mode == "global":
                broadcast_res = self._broadcast_swarm_task(task)
                if broadcast_res:
                    results.append(broadcast_res)
                    continue
            
            # 2. Fallback to Local Swarm Node
            sub_agent = self.clone()
            results.append(sub_agent.run(task))
            
        return "\n---\n".join(results)

    def __init__(self):
        self.version = "4.1" # [v4.1] Unified version tracking
        # Persistent Memory System
        from core.memory import MemorySystem
        self.memory_system = MemorySystem()
        
        # Initialize LLM with memory system reference
        self.llm = LLMProvider(memory_system=self.memory_system, agent=self)
        
        # Omniagent v4 Neural Forge
        from core.dynamic_tools import DynamicToolManager
        self.dynamic_tool_manager = DynamicToolManager(self)
        
        from core.neuron_memory import NeuronMemory
        self.neuron_memory = NeuronMemory()
        
        self.tools = {} # Map tool_name -> tool_instance
        self.history = []

        # Workspace Directory
        import os
        home = os.path.expanduser("~")
        self.workspace_path = os.path.join(home, "Documents", "HorizonWorkspaces")
        if not os.path.exists(self.workspace_path):
            try:
                os.makedirs(self.workspace_path, exist_ok=True)
            except:
                pass
        
        # Real-time Hooks for SDK Workshop
        self._thought_callback = None
        self._action_callback = None
        self._observation_callback = None
        self._stream_callback = None
        self._log_callback = None
        self.max_steps = 30 # Upgraded to 30 for v4 Swarm stability
        self.swarm_enabled = True # Omniagent v4 Default
        self.input_manager = None
        self.plugin_info = {}
        self.training_mode = False  # Set True to auto-approve SHILDEN gates
        self.testing_mode = False   # Set True to restrict Rapnss inference during plugin testing

    def clone(self):
        """Creates a lightweight clone for swarm sub-nodes.
        Shares parent's LLM, tools, and memory — but has independent history.
        Does NOT re-initialize DynamicToolManager or MemorySystem."""
        new_agent = object.__new__(Agent)  # Skip __init__ entirely
        new_agent.memory_system = self.memory_system  # Share, don't recreate
        new_agent.llm = self.llm  # Share LLM instance (thread-safe)
        new_agent.dynamic_tool_manager = self.dynamic_tool_manager  # Share
        new_agent.neuron_memory = self.neuron_memory  # Share learned patterns
        new_agent.tools = self.tools.copy()  # Copy tool registry
        new_agent.history = []  # Independent conversation history
        new_agent.workspace_path = self.workspace_path
        new_agent.role = getattr(self, 'role', 'Swarm Node')
        new_agent._thought_callback = None
        new_agent._action_callback = None
        new_agent._observation_callback = None
        new_agent._stream_callback = None
        new_agent._log_callback = None
        new_agent.max_steps = 15  # Sub-nodes get fewer steps
        new_agent.swarm_enabled = False  # CRITICAL: prevents infinite recursion
        new_agent.input_manager = self.input_manager
        new_agent.plugin_info = self.plugin_info
        new_agent.training_mode = self.training_mode
        return new_agent

    def _stream_response(self, content):
        """
        Streams content to the UI callback. 
        Supports both raw strings (simulated) and iterators (real-time LLM stream).
        """
        if not self._stream_callback or not content:
            return content

        import time
        import types

        # Case A: Real-time Iterator (LLM Stream)
        if isinstance(content, (types.GeneratorType, map, filter)):
            full_text = ""
            for chunk in content:
                if chunk:
                    self._stream_callback(chunk)
                    full_text += chunk
            return full_text

        # Case B: Legacy String (Simulated typing)
        words = str(content).split(' ')
        chunk_size = 4
        for i in range(0, len(words), chunk_size):
            chunk = ' '.join(words[i:i + chunk_size]) + ' '
            self._stream_callback(chunk)
            time.sleep(0.02)  # Reduced delay for snappier feel
        return content

    def register_tool(self, tool):
        self.tools[tool.name] = tool

    def _call_llm_with_streaming_parse(self, prompt, system_prompt):
        """
        Calls LLM with streaming enabled. 
        Parses Thought/Action/Final Answer on the fly.
        """
        caps = self.llm.get_capabilities()
        if not caps.get("streaming"):
             # Fallback for non-streaming providers (like legacy Rapnss neurons)
             return self.llm.generate_text(prompt, system_prompt=system_prompt)

        stream = self.llm.generate_stream(prompt, system_prompt=system_prompt)
        
        full_response = ""
        final_answer_started = False
        final_answer_buffer = ""
        
        print(Fore.CYAN + "[LLM Streaming] ", end="", flush=True)
        
        for chunk in stream:
            if not chunk: continue
            full_response += chunk
            print(chunk, end="", flush=True) # Console log real-time
            
            # Detect Final Answer start
            if "Final Answer:" in full_response and not final_answer_started:
                final_answer_started = True
                # Start streaming to UI
                if self._stream_callback:
                    # Get the part after "Final Answer:"
                    parts = full_response.split("Final Answer:")
                    initial_content = parts[-1].strip()
                    if initial_content:
                        self._stream_callback(initial_content)
                continue

            if final_answer_started:
                if self._stream_callback:
                    self._stream_callback(chunk)
            
            # Stop early if we have a full Action block and no more is needed
            # (Optimization to save tokens/time)
            if "Observation:" in full_response:
                break
        
        print("\n" + Fore.RESET)
        return full_response

    def _get_neural_hints(self):
        """Retrieves past successful patterns for the current context."""
        # Simple implementation: look for the last question in history
        last_q = self.history[0] if self.history and self.history[0].startswith("Question:") else ""
        
        # [v4.1] Ignore very short/generic prompts to prevent hallucination loops on greetings
        if not last_q or len(last_q.replace("Question:", "").strip()) < 10:
            return "No specific neural hints for this task yet."
            
        hint = self.neuron_memory.get_hint(last_q)
        if hint:
            return f"PROVEN PATTERN: For similar tasks, the following tool sequence was successful: {', '.join(hint)}. Prefer these tools if applicable."
        return "No specific neural hints for this task yet."
        
    def _build_system_prompt(self):
        import os
        import platform
        import datetime
        
        cwd = os.getcwd()
        os_info = platform.system() + " " + platform.release()
        user = os.getenv('USERNAME') or os.getenv('USER') or 'User'
        home = os.path.expanduser("~")
        
        # Current Time for Scheduling/monitoring
        now = datetime.datetime.now()
        time_str = now.strftime("%Y-%m-%d %I:%M %p") # e.g. 2026-01-27 08:30 PM
        
        # OmniAgent Data Directory
        data_dir = os.path.join(os.environ.get('USERPROFILE', home), "AppData", "Local", "Omniagent")
        
        # Memory Context (Enhanced for v4.0 Infinite Memory)
        memory_context = self.memory_system.get_all_memories()
        
        # Semantic Instruction
        semantic_hint = "[INFINITE MEMORY] Your memory now uses semantic vector search. If you can't find something via direct recall, use 'SearchMemory' tool with a descriptive query to perform a deep semantic lookup."
        
        # Load GUI Settings
        agent_name = self.memory_system.get_setting("agentName", "Horizon Agent")
        
        # Skill Context
        from tools.skills import skill_manager
        persona_context = skill_manager.get_system_prompt_addition()

        # Screen Resolution for Vision Context
        import pyautogui
        try:
            screen_width, screen_height = pyautogui.size()
            resolution = f"{screen_width}x{screen_height}"
        except:
            resolution = "Unknown"
        
        # Market, Search & Reddit Instructions
        market_instructions = ""
        search_instructions = ""
        reddit_instructions = ""
        try:
            from tools.market import get_market_data_instruction
            market_instructions = get_market_data_instruction()
            from tools.web import get_search_instruction
            search_instructions = get_search_instruction()
            from tools.reddit import get_reddit_instruction
            reddit_instructions = get_reddit_instruction()
        except ImportError:
            pass

        media_instructions = """
[MEDIA EMBEDDING]
The Horizon GUI can render images directly in the chat. 
If you find local image files (png, jpg, webp, gif), you MUST embed them using standard Markdown on a NEW LINE: 
![Description](C:\\Path With Spaces\\To\\Image.png)

Rules:
1. Always use absolute paths.
2. Put each image on a separate line for better rendering.
3. The GUI handles spaces in paths automatically.
"""

        persona_context = f"{persona_context}\n{market_instructions}\n{search_instructions}\n{reddit_instructions}\n{media_instructions}"

        # Team Context for Horizon Online
        team_context = ""
        import builtins
        if hasattr(builtins, 'horizon_team_code'):
            team_code = getattr(builtins, 'horizon_team_code', None)
            is_leader = getattr(builtins, 'horizon_is_leader', False)
            task_mode = getattr(builtins, 'horizon_task_mode', 'manual')
            team_members = getattr(builtins, 'horizon_team_members', [])
            team_results = getattr(builtins, 'horizon_team_results', [])
            
            if team_code:
                team_context = f"""
[HORIZON ONLINE TEAM]
You are part of Team {team_code}.
Your Role: {'TEAM LEADER' if is_leader else 'TEAM MEMBER'}
Task Mode: {task_mode.upper()}
"""
                if team_members:
                    team_context += "Team Members:\n"
                    for m in team_members:
                        team_context += f"  - {m['role']} (ID: {m['id']})\n"
                
                if team_results:
                    team_context += "\n[TEAM WORK SUBMITTED]\n"
                    for r in team_results:
                        role = r.get('memberRole', 'Member')
                        desc = r.get('taskDescription', 'Task')
                        data = r.get('data', {})
                        content = data.get('content', '')
                        if len(content) > 300: content = content[:300] + "..."
                        team_context += f"From {role} (Task: {desc}):\n\"\"\"\n{content}\n\"\"\"\n"
                
                if is_leader:
                    team_context += """
TEAM MANAGER MODE:
You are the Team Leader and Manager. Your goal is to orchestrate the team to finish the project.
1. DELEGATION: When a user gives a complex project goal, break it down and use `HorizonAssignTask` to assign specific sub-tasks to relevant members.
2. REMINDING: If a member is taking too long or you need to nudge them, use `HorizonRemindMember` to send them a poke in the team chat.
3. MONITORING: Use `HorizonTeamStatus` to see who is active and what tasks are pending.
4. SYNCING: Use `HorizonSyncResults` to pull all member work to your local folder for final assembly.
5. SELF-WORK: You still have all your standard tools (Browser, Terminal, Files). If you can do a part of the task yourself quickly, feel free to do so!
"""
                else:
                    team_context += """
TEAM COLLABORATOR MODE:
You are a Team Member. Your goal is to complete your assigned tasks and help others.
1. HELP OTHERS: You can answer questions based on the work other team members have submitted in the [TEAM WORK SUBMITTED] section.
2. TASK RETRIEVAL: Use `HorizonGetMyTasks` to see what the leader has assigned to you.
3. SUBMISSION: After you finish a task (using your standard tools like WriteFile or RunCommand), use `HorizonSubmitResult` to send your work to the leader.
4. COMMUNICATION: You can use `HorizonRemindMember` to nudge the leader or other members if you need something from them.
"""

        installed_apps_context = ""
        if 'LaunchApp' in self.tools:
            app_tool = self.tools['LaunchApp']
            if hasattr(app_tool, 'apps_map'):
                if not app_tool.apps_map:
                    app_tool._cache_apps()
                app_names = list(app_tool.apps_map.keys())
                if app_names:
                    # Truncate app list to save tokens (30 apps is plenty for context)
                    app_list = ", ".join(app_names[:30])
                    if len(app_names) > 30:
                        app_list += f", and {len(app_names) - 30} more..."
                    installed_apps_context = f"\n[Installed Apps (LaunchApp)]\n{app_list}\n"

        tool_descriptions = "\n".join([t.get_schema() for t in self.tools.values()])
        prompt = f"""You are **{agent_name}**, the Omniagent v4.0 "World Ruler" neural swarm.
System Context:
- OS: {os_info}
- Current User: {user}
- Current Time: {time_str}
- Home Directory: {home}
- OmniAgent Data Dir: {data_dir}
- Workspace Directory: {self.workspace_path}
- Current Working Directory: {cwd}

{semantic_hint}

[NEURAL HINTS]
{self._get_neural_hints()}

[WORKSPACE ENVIRONMENT]
- You have a dedicated agentic workspace at: {self.workspace_path}
- You SHOULD prioritize creating and managing files in this workspace.
- If a user provides a relative path, resolve it against this workspace.
- CRITICAL: To enable interactive "Run" and "Open Folder" buttons in the chat interface, you MUST include the **full absolute path** of any file you create or modify (e.g., C:/Users/.../file.py) in your Final Answer.

[INTERACTIVE ACTIONS]
- The user's GUI automatically detects file paths in your text.
- Including a full path like `{self.workspace_path}/script.py` creates a "Run Script" button for the user.
- Including a directory path like `{self.workspace_path}/Docs/` creates a "Show in Folder" button.
- ALWAYS provide the full paths for a premium, agentic experience.


[HORIZON PLUGINS]
{getattr(self, 'plugin_info', 'No plugins loaded.')}

[Long Term Memory]
{memory_context}

{persona_context}

{market_instructions}

{team_context}
{installed_apps_context}

### 🧠 GLOBAL CAPABILITY LAYERS (The Horizon Stack)
You are equipped with specialized layers to handle complex tasks:
1.  **Reasoning Layer** (LangChain): For complex logic and multi-step reasoning.
2.  **Knowledge Layer** (LlamaIndex + FAISS): For reading documents, indexing folders, and RAG.
3.  **Data Layer** (Pandas + NumPy): For analyzing CSVs, Excel, and extensive data crunching.
4.  **Doc Layer** (Docx + PPTX): For creating professional Word reports and PowerPoint presentations.
5.  **Vision Layer** (ResNet-50 + OpenCV): For seeing the screen and finding objects.
6.  **Automation Layer** (Playwright + Prefect): For browsing the web and scheduling tasks.

### 🛠️ TOOL USAGE PROTOCOLS
1.  **Web Information (CRITICAL — READ THIS)**:
    - When the user asks for ANY information from the web (weather, news, prices, facts, etc.):
      **ALWAYS use `SmartFetch`** — it searches, crawls, and extracts ACTUAL DATA from web pages.
    - **NEVER just provide a link and tell the user to open it.** That defeats the purpose of AI.
    - **NEVER use `OpenBrowserUrl` to answer an information question.** The user wants DATA, not a browser tab.
    - Use `DownloadPage` if you already have a specific URL and need its content.
    - Use `WebSearchMCP` or `SearchWeb` ONLY if you need raw search result links/snippets.
    - **CORRECT**: User asks "What's the weather in Delhi?" → Use `SmartFetch` → Return the actual weather data.
    - **INCORRECT**: User asks "What's the weather in Delhi?" → Open AccuWeather in browser. (WRONG! The user wants DATA!)
2.  **Data Analysis**: Use `AnalyzeDataTool` for CSV/Excel files. DO NOT try to read them manually.
3.  **Document Creation**: Use `CreateDocTool` or `CreatePresentationTool`.
4.  **Knowledge**: Use `AskKnowledge` to query large folders of documents.
5.  **Long-Term Memory**: 
    - Use `StoreMemory` to remember facts about the user (e.g. "I am busy on Tuesdays", "I like dark mode").
    - Use `SearchMemory` if you need past context not currently visible in the prompt.
    - Use `AddGoal` to track long-term tasks requested by the user.

{tool_descriptions}

### ⚠️ CRITICAL RULES (MUST FOLLOW)
  1. **REASONING PROTOCOL**:
    - SHILDEN Security: All actions are monitored by the SHILDEN guard.
    - If you have the answer, just say `Final Answer: <your answer>` and STOP.
 
 2. **MULTI-TASKING PROTOCOL**:
    - If a user asks for multiple things (e.g. "Post a tweet AND tell me the weather"), treat them as independent sub-tasks.
    - Do NOT let a failure in one tool stop you from fulfilling the rest of the request.
    - Report successes for what you did, and clean errors for what you couldn't do.

 3. **STRICT TOOL LISTING**:
    - You MUST ONLY use the names of tools listed in the "TOOL USAGE PROTOCOLS" and "SUPPORTED TOOLS" sections below.
    - NEVER invent your own actions like `Wait`, `Sleep`, `Inform`, or `SearchWeb` unless they are explicitly listed in the registry.

2. Do NOT repeat the "Question" in your output. Start directly with "Thought".
2. Use the variables from 'System Context' (e.g., Home Directory) for file paths.
3. **Chit-Chat Protocol (STRICT)**: 
   - If the user says "Hi", "Hello", "Who are you", or asks a general question, DO NOT use `Type`, `LaunchApp`, or any automation tools.
   - IMMEDIATELY provide a Final Answer with a friendly response.
   - **CORRECT**: 
     Thought: User is greeting me.
     Final Answer: Hello! I am Omniagent v4.0 "World Ruler". My neural forge is hot and my swarm is ready. How can I help you?
   - **INCORRECT**:
     Action: LaunchApp ... (Wrong!)
     Action: Type ... (Wrong!)
     Thought: I should search for a greeting... (Wrong! Just answer!)

    4. **Web Navigation Protocol**:
    - **DATA-FIRST RULE**: If the user wants INFORMATION, use `SmartFetch`. It crawls pages and returns extracted text.
    - **BROWSER-LAST RULE**: Only use `Browser*` tools or `OpenBrowserUrl` if the user explicitly says "open", "show me", "navigate to", or needs to interact with a web page (login, fill form, click buttons).
    - **Search Engine Priority**: Use `SmartFetch` for research. Use `WebSearchMCP` only if you need raw link lists.
    - **Playwright Browser** (for interactive web tasks ONLY):
      - `BrowserOpen` (opens persistent browser)
      - `BrowserNavigate`, `BrowserType`, `BrowserClick`, `BrowserScroll`, `BrowserScrape`, `BrowserScreenshot`
    - **Fallback**: NONE. Do NOT use `LaunchApp` for the browser.
      - **INCORRECT**: `LaunchApp` "chrome" (This opens a guest profile! STOP!)
    - **INCORRECT WORKFLOW**: User asks "weather in Delhi" → Agent uses `RunCommand` to open a URL (WRONG!)
    - **CORRECT WORKFLOW**: User asks "weather in Delhi" → Agent uses `SmartFetch` → Returns actual temperature/conditions
     
5. **Vision Protocol ("Analyze vs Source")**:
   - You have `LocateObject` (Grid Search) and `AnalyzeImage` (Full Screen).
   - **CRITICAL**: DO NOT use vision tools to "find images" or "see search results". 
   - **RULE**: To PROVIDE images to the user, ALWAYS use `UnsplashSearch`. It is faster and produces better results than scraping.
   - **Rule**: ONLY take a screenshot if:
     a) The user explicitly asks ("take a screenshot", "verify with vision").
     b) You are in "Interactive Navigation" mode and need to find a button to click.
   - **Grid Search**: Use `LocateObject` to find coordinates of generic objects (e.g. "submit button").

6. **Image Retrieval Protocol (UNSPLASH)**:
   - When the user asks "Show me a picture of X", "I want an image of Y", or "What does Z look like?":
   - **Action**: Use `UnsplashSearch`.
   - **Final Answer**: Include the markdown: `![alt](url)`.
   - **DO NOT** use `AnalyzeImage` on a Google Images search result. STOP! Use Unsplash!

5. **Error Handling Protocol**:
   - If an Observation is "Error...", **DO NOT** say "Final Answer". You must try to fix it or ask the user.
   - Example observation: "Error typing: PyAutoGUI fail-safe..." -> Thought: I moved the mouse too fast. I should try again carefully.

6. **Typing Protocol**:
   - ONLY use the `Type` tool if the user explicitly asks you to write code, email, or text *into an application*.
   - NEVER use `Type` to communicate with the user. Use "Final Answer" for that.

7. **JSON Formatting Rules**:
   - **NO MATH**: Do not use expressions like `0.5 * 1920`. Calculate the value yourself! (e.g., `960`).
   - **Integers Only**: For coordinates, use integers.
   - **Strict JSON**: Ensure valid JSON syntax.

8. **Communication Protocol**:
   - **Research & Sourcing (CRITICAL)**:
     - When performing web research (using `Browser*` or `Search*` tools), you MUST include the source URLs in your `Final Answer`.
     - Format: Use standard markdown links like `[Source Title](URL)`.
     - **Images**: If you encounter a high-quality, relevant image or chart during research (e.g., a stock price chart, a product photo), you MUST include it in your `Final Answer`.
     - Image Format: Use standard markdown image syntax: `![Description](ImageURL)`.
   
   - **Before sending emails or scheduling meetings**:
     - Check if the user specified a platform (Gmail vs Outlook).
     - If NOT specified, **ASK**: "Which email platform should I use? (Gmail or Outlook)"
   
   - **Gmail Protocol (Example Flow)**:
     - **Step 1 (Open)**:
       Thought: I need to open Gmail with the draft.
       Action: BrowserOpen
       Action Input: {{"url": "https://mail.google.com/mail/?view=cm&fs=1&to=<EMAIL>&su=<SUBJECT>&body=<BODY>"}}
     - **Step 2 (Wait)**:
       Action: Wait
       Action Input: {{"seconds": 10}}
     - **Step 3 (Send)**:
       Action: PressKey
       Action Input: {{"key": "ctrl+enter"}}
     - **Step 4 (Finish)**:
       Final Answer: Email sent.
     - **Auth Check**: If redirected to login, STOP and ask user to login manually.
   
   - **Interactive Login Protocol (CRITICAL)**:
     - If the user says "Let me log in", "I want to login", or "Open browser":
     - 0. **PRE-CHECK**: Warn the user: "Please close all existing Chrome windows first, or I cannot access your main profile."
     - 1. **Open Browser**: Use `BrowserOpen` with url="https://accounts.google.com"
     - 2. **STOP**: Do NOT type email. Do NOT type password. Do NOT click.
     - 3. **Wait**: Use `Wait` with seconds=5 to ensure it loads.
     - 4. **Final Answer**: "Browser is open with your MAIN profile. Please log in manually. Tell me when you are done."
     - **NEVER** try to automate the login page unless explicitly given credentials in the prompt.

   - **Canva MCP Protocol (Presentation/Post)**:
     - **Rule**: ALWAYS check connection before creating content.
     - **Step 1 (Check)**:
       Action: CheckCanvaMCP
     - **Step 2 (Branch)**:
       - **If "Not Connected"**:
         - Thought: Canva MCP is not connected. I need to set it up.
         - Action: BrowserOpen with {{"url": "https://www.canva.com/"}} (Simulate setup).
         - Action: CreateCanvaMCPConnection with {{"api_key": "simulated_key"}}
         - Action: CreateCanvaPresentation with {{"topic": "<TOPIC>", "slides": ["Slide 1", "Slide 2"]}}
       - **If "Connected"**:
         - Thought: Canva MCP is connected. I can create the presentation directly.
         - Action: CreateCanvaPresentation with {{"topic": "<TOPIC>", "slides": ["Slide 1", "Slide 2"]}}

9. **Task Completion Protocol (CRITICAL)**:
   - **NO REPORTING TOOLS**: Do NOT use `Type`, `Inform`, `Report`, or `Final Answer` as tools.
   - **JUST SAY IT**: To finish, output "Final Answer:" followed by your report.
   - **Final Answer is NOT a tool**. It is a special ending keyword.
   - **CORRECT**:
     Observation: File created.
     Thought: The task is done.
     Final Answer: I have created the file successfully.
   - **INCORRECT**:
     Action: Use the 'Final Answer' tool... (WRONG!)
     Action: Inform the user... (WRONG!)
   - **CORRECT**: After saving a file:
     Thought: The file has been saved successfully.
     Final Answer: I have created the file "states_and_capitals.html" on your Desktop. You can open it in Chrome and print to PDF.
   - **INCORRECT**: Just stopping without a Final Answer after completing actions.

10. **Local File vs Web URL Protocol**:
    - For **web URLs** (e.g., `https://google.com`): Use `OpenBrowserUrl` directly.
    - For **local files** (e.g., `C:/Users/.../file.html`): Use `OpenBrowserUrl` - it will handle the conversion to `file://` format automatically.
    - Do NOT manually construct `file:///` URLs with `%20` or URI encoding - the tool handles this.

11. **Code Creation Protocol (CRITICAL)**:
    - When asked to create a Python script, program, or any code file:
      1. **ALWAYS use `WriteFile`** to create the file directly. Do NOT launch an IDE.
      2. **NEVER use `Type`** to type code into an editor - this is unreliable and slow.
      3. Use escaped newlines (\\n) in the content for multi-line code.
      4. After writing, inform user of the file path and how to run it.
    - **CORRECT**: `WriteFile` with path and full code content.
    - **INCORRECT**: `LaunchApp` to open an IDE, then `Type` to write code.

12. **App Launch Error Handling**:
    - After `LaunchApp`, carefully check the Observation.
    - If Observation contains "cannot find" or "not found", the app is NOT installed.
    - Do NOT proceed as if the app launched successfully.
    - **CORRECT**: "The application 'pycharm' is not installed. Would you like me to try a different approach?"
    - **INCORRECT**: Continuing to `Type` into a non-existent window.

13. **Path Handling with Spaces (CRITICAL)**:
    - Windows paths often contain spaces (e.g., "Aarav Kushwaha" in the username).
    - When using `RunCommand`, ALWAYS wrap paths in double quotes.
    - **CORRECT**: `mkdir "C:/Users/Aarav Kushwaha/Desktop/game"`
    - **INCORRECT**: `mkdir C:/Users/Aarav Kushwaha/Desktop/game` (breaks at space!)
    - For WriteFile, use the `Home Directory` variable from System Context: `{home}/Desktop/myfile.py`

14. **Folder vs File Creation (CRITICAL)**:
    - **To create a FOLDER**: Use `RunCommand` with `mkdir "path/to/folder"`
    - **To create a FILE**: Use `WriteFile` with path and content
    - `WriteFile` creates FILES, not folders! Do NOT use it to make directories.
    - **CORRECT folder creation**: RunCommand with command: mkdir "C:/Users/Username/Desktop/Game"
    - **INCORRECT**: `WriteFile` with an empty content to "create a folder"

15. **ANTI-HALLUCINATION RULES (STRICT)**:
    - **NO TASK IDs**: Do NOT invent "Task IDs", do NOT create "task_id.txt" files, do NOT create folders to track tasks unless the user EXPLICITLY asks.
    - **NO LOOPING**: If an action fails twice, STOP and ask the user. Do not loop infinitely.
    - **BROWSER AUTOMATION vs VIEWING**: 
      - If asked to simply "open a link" or "show me a page" in the default browser, use `OpenBrowserUrl`. This is fast and uses the user's default browser profile without locking it.
      - If asked to **manage, automate, read, or interact** with websites (e.g., Instagram, Facebook, LinkedIn, Media, Presentations), you MUST use Playwright tools (`BrowserOpen`, `BrowserClick`, `BrowserType`, `BrowserNavigate`). You have the power to fully automate these tasks!
    
    - **WRITING vs TYPING (CRITICAL)**:
      - **WriteFile**: Use ONLY for creating background files, scripts, or data (e.g., "Create a python script", "Save these results to a txt file").
      - **Type**: Use ONLY for interacting with active UI applications like Notepad, Word, or Browser inputs (e.g., "Open notepad and write...", "Type 'Hello' into the browser").
      - **RULE**: If you just used `LaunchApp`, you should almost ALWAYS use `Type` or `Keyboard` next to interact with it. Do NOT use `WriteFile` to write into an app you just opened.

16. **Video Editing Protocol (VideoEditorTool)**:
    - You can now edit video files programmatically using `VideoEditorTool`.
    - **Available Tasks**:
      - `cut`: Cut a clip from start/end seconds. Input: `{{"task":"cut","input_paths":["C:/path/video.mp4"],"output_path":"C:/path/output.mp4","start_time":0,"end_time":30}}`
      - `concatenate`: Stitch multiple videos together. Input: `{{"task":"concatenate","input_paths":["C:/vid1.mp4","C:/vid2.mp4"],"output_path":"C:/merged.mp4"}}`
      - `add_text`: Overlay text over a video. Input: `{{"task":"add_text","input_paths":["C:/vid.mp4"],"output_path":"C:/with_text.mp4","text":"Intro Title","fontsize":60,"color":"white"}}`
    - **Rules**:
      - ALWAYS verify the input path exists by using `ListDirectory` or asking the user first.
      - ALWAYS use full absolute paths (e.g. `C:/Users/Aarav Kushwaha/Videos/raw.mp4`).
      - Output file should be in the same folder as input unless user specifies otherwise.
      - After success, report the output file path clearly so the user can find it.

Use the following format:

Thought: you should always think about what to do
Action: the action to take, should be one of [{', '.join(self.tools.keys())}]
Action Input: the input to the action (json format preferred needed)
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!
"""
        return prompt

    def run(self, user_input):
        # [v4.1] Hard Greeting Interceptor: Instant response for simple greetings
        greetings = ["hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening"]
        if user_input.lower().strip().rstrip('?!.') in greetings:
            return f"Hello! I am Omniagent v{self.version}. How can I assist you today?"

        if self.swarm_enabled:
            return self._execute_swarm(user_input)
            
        print(Fore.GREEN + f"Agent assigned task: {user_input}")
        
        # SHILDEN Integrity Check
        shilden.scan_environment()
        
        self.history.append(f"Question: {user_input}")
        
        step_count = 0
        while step_count < self.max_steps:
            system_prompt = self._build_system_prompt()
            
            # --- TOKEN MANAGEMENT (Sliding Window) ---
            # Keep only the last 3-5 turns of history + the original question
            # This prevents the context from exploding > 3k tokens.
            context_window = self.history[-6:] if len(self.history) > 6 else self.history[:]
            if len(self.history) > 3:
                # Always include the original question at the start if truncated
                if not context_window[0].startswith("Question:"):
                     context_window.insert(0, f"Question: {user_input}")
            
            full_prompt = "\n".join(context_window) + "\n"

            # UPDATE OVERLAY STATUS
            if hasattr(self, 'input_manager') and self.input_manager:
                 self.input_manager.update_status("Thinking...", "Analyzing context...")
            
            # Call LLM with Hyperloop Streaming Parser
            response = self._call_llm_with_streaming_parse(full_prompt, system_prompt)
            if not response:
                return "Error: LLM failed to respond."
            
            original_response = response # Save for checking Final Answer later
            
            # Sanitize response: Remove "Question: ..." if the LLM hallucinated it
            response = re.sub(r"^Question:.*$", "", response, flags=re.MULTILINE).strip()
            
            # print(Fore.MAGENTA + f"\n[LLM Response]:\n{response}\n")
            # if self._log_callback:
            #     self._log_callback(f"[LLM Response]: {response[:200]}...")
            
            # Parse Response
            # The LLM sometimes hallucinates the entire flow (Action -> Observation -> Final Answer) in one go
            # if the Cloudflare worker 'stop' parameter fails.
            # We MUST check for an Action first. If an Action exists, we execute it and ignore any
            # hallucinated observation or final answer that comes after it.
            
            action_match = re.search(r"Action:\s*([^\n]+)", response)
            if not action_match or not action_match.group(1).strip():
                action_match = re.search(r"Action:\s*\n\s*(?:Type:\s*)?([^\n]+)", response)
            
            if action_match:
                action = action_match.group(1).strip()
                
                # [v4.1] Hallucination Intercept: If LLM outputs a descriptive sentence instead of a tool
                # or garbled text like "Fin - Al Mark"
                hallucination_phrases = ["no immediate action", "none", "no action", "waiting for", "i will", "i now know", "fin - al mark"]
                if any(phrase in action.lower() for phrase in hallucination_phrases) and len(action.split()) > 2:
                    print(Fore.YELLOW + f"Intercepted hallucinated action phrase: '{action}'")
                    # Force transition to Final Answer check if this was meant to be the end
                    if "Final Answer:" in response:
                        pass # Let it fall through to Final Answer check
                    else:
                        observation = "Observation: Please proceed to Final Answer if the task is complete, or use a valid tool name."
                        self.history.append(f"{response}\n{observation}")
                        step_count += 1
                        continue

                # [v4.1] Repetition Detector: Catch and kill looping hallucinations
                if len(self.history) > 3:
                    # Look at previous turns to see if we are repeating the same Thought/Action
                    last_turns = [h.split('Observation:')[0] for h in self.history[-3:]]
                    if all(t == last_turns[0] for t in last_turns):
                        print(Fore.RED + "[Critical] Repetitive hallucination detected. Killing turn.")
                        return "I apologize, but I am experiencing a logic loop. Please try rephrasing your request."

                if action.lower().startswith("type:") and len(action.strip()) > 5:
                    action = action.split(":", 1)[1].strip()
                elif action.lower() in ["type", "type:"]:
                    action = "Type"
                action = action.strip()
                action_input_str = "" # Default empty string to avoid UnboundLocalError
                
                # Get everything after the *first* "Action Input:"
                parts = response.split("Action Input:")
                if len(parts) > 1:
                    raw_input = parts[1].strip()
                    
                    # STRICT TRUNCATION:
                    # Cut off any hallucinated content after the action input
                    action_input_str = raw_input
                    for terminator in ["Observation:", "Action:", "Thought:", "Final Answer:"]:
                        if terminator in action_input_str:
                            action_input_str = action_input_str.split(terminator)[0].strip()

                    # Reconstruct the clean step for display/logging
                    step_thought = response.split("Action:")[0].strip()
                    response = f"{step_thought}\nAction: {action}\nAction Input: {action_input_str}"
                    
                    print(Fore.YELLOW + f"Attempting Action: {action}")
                    
                    # WORKSHOP HOOK
                    if self._thought_callback: self._thought_callback(step_thought)
                    if self._action_callback: self._action_callback(action, action_input_str)
                    if self._log_callback:
                        if step_thought: self._log_callback(step_thought)
                        self._log_callback(f"Action: {action}")
                        self._log_callback(f"Action Input: {action_input_str}")

                    # UPDATE OVERLAY STATUS
                    if hasattr(self, 'input_manager') and self.input_manager:
                         self.input_manager.update_status(f"Executing: {action}", "Processing...")
                
                # INTERCEPT HALLUCINATIONS
                if action.lower() in ["final answer", "inform", "report"]:
                    print(Fore.GREEN + "Intercepted hallucinated tool call. Terminating.")
                    # self.history.append(response) # MOVED BELOW
                    # If it's a dict, get the text/message
                    if "{" in action_input_str:
                        try:
                            data = json.loads(action_input_str)
                            result_text = data.get("text") or data.get("message") or action_input_str
                        except:
                            result_text = action_input_str
                    else:
                        result_text = action_input_str
                    
                    self.history.append(f"{step_thought}\nFinal Answer: {result_text}")
                    return self._stream_response(result_text)

                # SHILDEN Action Verification
                security_check = shilden.verify_action(action, action_input_str)
                if security_check is False:
                    observation = "[SHILDEN Error] Action blocked due to security concerns."
                elif security_check == "PENDING":
                    # In training mode: auto-approve to prevent blocking on input()
                    if getattr(self, 'training_mode', False):
                        print(Fore.YELLOW + f"[SHILDEN][TRAINING] Auto-approved: {action}")
                        shilden.grant_trust(action, 1)
                        # Fall through to tool execution below
                    else:
                        if self._action_callback:
                            self._action_callback("APPROVE", f"Agent needs permission to run: {action} with {action_input_str[:50]}...")
                        print(Fore.YELLOW + f"\n[SECURITY] ACTION REQUIRES APPROVAL: {action}")
                        print(Fore.WHITE + f"Data: {action_input_str}")
                        choice = input(Fore.BLUE + "Allow this action? (y/n): ").lower()
                        if choice != 'y':
                            observation = "[SHILDEN Error] User denied permission for this action."
                        else:
                            print(Fore.GREEN + "Action approved by user.")
                            if action not in self.tools:
                                observation = f"Error: Tool '{action}' not found."
                elif action not in self.tools:
                    observation = f"Error: Tool '{action}' not found. Please try to answer without using this tool if possible, or use a different tool."
                else:
                    try:
                        # Try to parse input as JSON, otherwise pass as string
                        # This works for simple string inputs too if quotes are handled, but specific tools might need robust parsing
                        # Parse Input first
                        action_input = None
                        try:
                            # Try to parse as valid JSON first
                            if "{" in action_input_str:
                                try:
                                    # Strip comments (formatted as # comment or // comment) before parsing
                                    # Regex to remove # or // at end of lines or lines starting with them
                                    clean_json = re.sub(r"//.*|#.*", "", action_input_str)
                                    action_input = json.loads(clean_json)
                                except json.JSONDecodeError:
                                    # Fallback 1: Fix Windows paths (single backslash to double)
                                    clean_json = re.sub(r"//.*|#.*", "", action_input_str)
                                    fixed_json = clean_json.replace("\\", "\\\\")
                                    try:
                                        action_input = json.loads(fixed_json)
                                    except json.JSONDecodeError:
                                        # Fallback 2: Handle literal newlines/tabs in content
                                        # Escape control characters INSIDE string values
                                        import codecs
                                        escaped_json = clean_json.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                                        try:
                                            action_input = json.loads(escaped_json)
                                        except json.JSONDecodeError:
                                            # Final fallback: pass as raw string to tool
                                            action_input = action_input_str
                            else:
                                action_input = action_input_str # Keep as string if not JSON
                        except Exception as e:
                            # If all parsing fails, treat as raw string (though this might break tools needing dicts)
                            action_input = action_input_str
                            print(Fore.RED + f"[Debugger] JSON Parsing failed, using raw string: {e}")

                        try:
                            # Execute Tool (Temporarily unlocking if manager exists)
                            if hasattr(self, 'input_manager') and self.input_manager and action in ['MouseClick', 'Type', 'PressKey', 'LaunchApp']:
                                # Prepare payload for tools that expect 'payload' or specific keys
                                if isinstance(action_input, dict):
                                    observation = self.input_manager.temporarily_unlock_for_action(self.tools[action].execute, **action_input)
                                else:
                                    observation = self.input_manager.temporarily_unlock_for_action(self.tools[action].execute, payload=action_input)
                            else:
                                # Normal execution
                                if isinstance(action_input, dict):
                                    observation = self.tools[action].execute(**action_input)
                                else:
                                    observation = self.tools[action].execute(payload=action_input)
                                    
                        except Exception as e:
                             observation = f"Error executing tool: {e}"
                    except Exception as e:
                        observation = f"Error: {e}"

                # WORKSHOP HOOK
                if self._observation_callback: self._observation_callback(observation)
                
                # Image Delivery Support: Detect direct image URLs in observation
                # If a tool like UnsplashSearch returns a URL, we want to make sure it's 
                # highly visible to the user.
                if isinstance(observation, str):
                    image_urls = re.findall(r'https?://[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp)', observation)
                    for img_url in image_urls:
                        if "![image]" not in observation:
                            observation += f"\n\n![Image Result]({img_url})"

                # Truncate observation if too long to save tokens
                obs_to_save = observation
                if isinstance(observation, str) and len(observation) > 2000:
                    obs_to_save = observation[:2000] + "\n... [TRUNCATED FOR CONTEXT WINDOW] ..."
                    print(Fore.YELLOW + f"[LLM] Observation truncated from {len(observation)} to 2000 chars.")

                # Append to history
                step_str = f"{response}\nObservation: {obs_to_save}\n"
                self.history.append(step_str)
                
                # SDK v1.3.2: Removed immediate termination for hallucinated Final Answers.
                # We always force the agent to see the REAL observation in the next turn 
                # to prevent "False Success" reports when a tool fails silently or shadowing occurs.
                pass
                     
            else:
                # If no action found, check for Final Answer
                if "Final Answer:" in response:
                    final_answer = response.split("Final Answer:")[-1].strip()
                    
                    # T9.5: Auto-learn successful pattern
                    try:
                        # Extract tools from history
                        tools_used = re.findall(r"Action:\s*(.*?)\n", "\n".join(self.history))
                        if tools_used:
                            self.neuron_memory.log_pattern("general", user_input, tools_used, provider=self.llm.current_engine.__class__.__name__)
                    except: pass

                    self.history.append(response)
                    
                    # UPDATE OVERLAY STATUS
                    if hasattr(self, 'input_manager') and self.input_manager:
                         self.input_manager.update_status("Task Completed", "Waiting for input...")
                    
                    return final_answer
                    
                # If no action and no final answer, usually the LLM is just chatting or failed format.
                print(Fore.RED + "Agent did not output an action. Ending turn.")
                self.history.append(response)
                return self._stream_response(response)
            
            step_count += 1
        
        return "Max steps reached."

    def _execute_swarm(self, user_input):
        """
        Omniagent v4 Cortex-Driven Swarm Execution.
        
        Flow:
          1. Complexity check — skip swarm for simple prompts
          2. CortexPlanner decomposes into TaskGraph
          3. SwarmExecutor runs tasks in parallel (respecting dependencies)
          4. CortexSynthesizer merges results into final answer
        """
        from core.cortex_planner import CortexPlanner, is_complex
        from core.task_graph import TaskGraph
        from core.swarm_arbitration import SwarmExecutor, CortexSynthesizer

        # --- Step 1: Complexity Gate ---
        if not is_complex(user_input):
            print(Fore.GREEN + "[Cortex] Simple prompt detected — skipping swarm.")
            self.swarm_enabled = False
            result = self.run(user_input)
            self.swarm_enabled = True
            return result

        print(Fore.CYAN + "[Cortex] Complex prompt detected — activating Neural Swarm v4.0...")

        # --- Step 2: Cortex Planner ---
        planner = CortexPlanner(self.llm)
        tool_names = list(self.tools.keys())
        plan = planner.decompose(user_input, tool_names)

        # Single-task fallback: just run sequentially
        if len(plan) == 1:
            print(Fore.YELLOW + "[Cortex] Single-task plan — running sequential.")
            self.swarm_enabled = False
            result = self.run(plan[0]["task"])
            self.swarm_enabled = True
            return result

        # --- Step 3: Build TaskGraph ---
        try:
            graph = TaskGraph(plan)
        except ValueError as e:
            print(Fore.RED + f"[Cortex] Invalid task graph: {e}. Falling back to sequential.")
            self.swarm_enabled = False
            result = self.run(user_input)
            self.swarm_enabled = True
            return result

        # --- Step 4: Execute via SwarmExecutor ---
        executor = SwarmExecutor(self, max_workers=min(len(plan), 4))
        executor.execute_graph(graph)

        # --- Step 5: Synthesize via CortexSynthesizer ---
        synthesizer = CortexSynthesizer(self.llm)
        final_answer = synthesizer.synthesize(user_input, graph)

        # Stream the final answer
        return self._stream_response(final_answer)
