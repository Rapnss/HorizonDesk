import os
import json
import importlib.util
import sys
from colorama import Fore

class PluginManager:
    def __init__(self, agent):
        self.agent = agent
        self.plugins = {} # Map plugin_name -> plugin_metadata
        
        if getattr(sys, 'frozen', False):
            base_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        else:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
            
        self.bundled_plugins_dir = os.path.join(base_dir, "plugins")
        
        appdata = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        self.user_plugins_dir = os.path.join(appdata, "HorizonDesk", "plugins")
        
        if not os.path.exists(self.user_plugins_dir):
            try:
                os.makedirs(self.user_plugins_dir)
            except:
                pass
                
        self.plugin_dirs = [self.bundled_plugins_dir, self.user_plugins_dir]

    def load_plugins(self, force_reload=False):
        """Scans 'plugins' directories for subdirectories containing 'horizon_plugin.raf'."""
        if force_reload:
            self._unload_all_plugins()

        for p_dir in self.plugin_dirs:
            if not os.path.exists(p_dir):
                continue

            print(Fore.CYAN + f"Scanning for plugins in {p_dir}...")
            
            for item in os.listdir(p_dir):
                plugin_path = os.path.join(p_dir, item)
                
                if os.path.isdir(plugin_path):
                    raf_file = os.path.join(plugin_path, "horizon_plugin.raf")
                    
                    if os.path.exists(raf_file):
                        try:
                            self._load_single_plugin(plugin_path, raf_file)
                        except Exception as e:
                            print(Fore.RED + f"Failed to load plugin '{item}': {e}")

    def _load_single_plugin(self, plugin_path, raf_file):
        # 1. Parse RAF file (JSON format for now)
        try:
            with open(raf_file, 'r') as f:
                metadata = json.load(f)
        except json.JSONDecodeError:
            print(Fore.RED + f"Invalid JSON in {raf_file}")
            return

        name = metadata.get("name")
        entry_point = metadata.get("entry_point", "main.py")
        
        if not name or not entry_point:
            print(Fore.YELLOW + f"Skipping {plugin_path}: Missing 'name' or 'entry_point' in .raf")
            return

        # 2. Import the entry point python file
        entry_file = os.path.join(plugin_path, entry_point)
        if not os.path.exists(entry_file):
            print(Fore.RED + f"Plugin entry point not found: {entry_file}")
            return

        spec = importlib.util.spec_from_file_location(f"plugins.{name}", entry_file)
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"plugins.{name}"] = module
        
        # In case it was already loaded, uncache it
        if f"plugins.{name}" in sys.modules and getattr(module, "__file__", None) == entry_file:
            # Forcing a fresh load
            importlib.reload(module) if hasattr(module, "register_tools") else spec.loader.exec_module(module)
        else:
            spec.loader.exec_module(module)

        # 3. Register Tools
        # Expectation: Module has a function `register_tools(agent)` or list `TOOLS`
        if hasattr(module, "register_tools"):
            module.register_tools(self.agent)
            print(Fore.GREEN + f"[Plugin] Loaded '{name}' by {metadata.get('developer', 'Unknown')}")
            
            # Keep track of which tools were added by this plugin
            if not hasattr(self.agent, '_plugin_tools_map'):
                self.agent._plugin_tools_map = {}
            
            current_tools = set(self.agent.tools.keys())
            module.register_tools(self.agent)
            new_tools = set(self.agent.tools.keys()) - current_tools
            
            self.agent._plugin_tools_map[name] = list(new_tools)
            
            # SDK v1.2.0: Detect custom sidebar UI tab
            if metadata.get("custom_ui") and metadata.get("custom_ui_path"):
                ui_abs = os.path.join(plugin_path, metadata["custom_ui_path"])
                metadata["_ui_abs_path"] = ui_abs
                print(Fore.CYAN + f"[Plugin] '{name}' has custom UI tab at: {ui_abs}")
            
            self.plugins[name] = metadata
        else:
            print(Fore.YELLOW + f"Plugin '{name}' has no 'register_tools(agent)' function.")

    def _unload_all_plugins(self):
        """Removes all plugin tools from the agent so we don't get duplicates on reload."""
        if not getattr(self.agent, '_plugin_tools_map', None):
            self.plugins.clear()
            return
            
        for plugin_name, tool_names in self.agent._plugin_tools_map.items():
            for t_name in tool_names:
                if t_name in self.agent.tools:
                    del self.agent.tools[t_name]
                    
        self.agent._plugin_tools_map.clear()
        self.plugins.clear()

    def get_installed_plugins(self):
        """Returns metadata of all plugins found in the plugins directories."""
        installed = []
        for p_dir in self.plugin_dirs:
            print(f"[PluginManager] Scanning: {p_dir}")
            if not os.path.exists(p_dir):
                print(f"[PluginManager] Directory not found: {p_dir}")
                continue
                
            for item in os.listdir(p_dir):
                plugin_path = os.path.join(p_dir, item)
                if os.path.isdir(plugin_path):
                    raf_file = os.path.join(plugin_path, "horizon_plugin.raf")
                    if os.path.exists(raf_file):
                        try:
                            with open(raf_file, 'r') as f:
                                metadata = json.load(f)
                                metadata['folder_name'] = item
                                 # SDK v1.2.0: Pass custom_ui_path to frontend
                                if metadata.get('custom_ui') and metadata.get('custom_ui_path'):
                                    metadata['ui_folder'] = os.path.join(plugin_path, metadata['custom_ui_path'])
                                    print(f"[PluginManager] Found Custom UI Plugin: {metadata.get('name')} in {item}")
                                    
                                    # Generate icon URL if specified
                                    if metadata.get('icon'):
                                        metadata['icon_url'] = f"http://127.0.0.1:5173/plugin-ui/{item}/{metadata.get('icon')}"
                                else:
                                    metadata['ui_folder'] = None
                                installed.append(metadata)
                        except:
                            pass
        return installed

    def open_plugin_folder(self, folder_name):
        """Opens the specified plugin folder in the OS file explorer."""
        import subprocess
        for p_dir in reversed(self.plugin_dirs):
            plugin_path = os.path.join(p_dir, folder_name)
            if os.path.exists(plugin_path):
                if sys.platform == 'win32':
                    os.startfile(plugin_path)
                elif sys.platform == 'darwin':
                    subprocess.Popen(['open', plugin_path])
                else:
                    subprocess.Popen(['xdg-open', plugin_path])
                return True
        return False

    def get_plugin_info(self):
        """Returns a string summary of loaded plugins."""
        if not self.plugins:
            return "No Horizon plugins are currently loaded."
        
        lines = ["Installed Horizon Plugins:"]
        for name, meta in self.plugins.items():
            dev = meta.get('developer', 'Unknown')
            desc = meta.get('description', 'No description provided.')
            ver = meta.get('version', '1.0')
            lines.append(f"- {name} (v{ver}) by {dev}: {desc}")
        return "\n".join(lines)

