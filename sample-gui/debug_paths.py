import os
import sys

def resource_path(*relative_parts):
    if getattr(sys, 'frozen', False):
        base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    else:
        # Running from source — base is the project root (one level up from sample-gui/)
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    return os.path.join(base, *relative_parts)

print(f"File: {os.path.abspath(__file__)}")
print(f"Dirname: {os.path.dirname(os.path.abspath(__file__))}")
print(f"Base: {os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))}")
print(f"Dist index: {resource_path('sample-gui', 'dist', 'index.html')}")
print(f"Exists: {os.path.exists(resource_path('sample-gui', 'dist', 'index.html'))}")
