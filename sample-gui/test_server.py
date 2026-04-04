import os
import sys
import threading
import time
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

def resource_path(*relative_parts):
    if getattr(sys, 'frozen', False):
        base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    else:
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    return os.path.join(base, *relative_parts)

class TestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        clean_path = urllib.parse.unquote(parsed_path.path).strip()
        rel_path = clean_path.lstrip('/')
        if not rel_path: rel_path = 'index.html'
        
        dist_path = resource_path('sample-gui', 'dist', rel_path)
        print(f"Request: {clean_path} -> {dist_path}")
        
        if os.path.exists(dist_path) and os.path.isfile(dist_path):
            self.send_response(200)
            self.end_headers()
            with open(dist_path, 'rb') as f:
                self.wfile.write(f.read())
            print("Served 200")
        else:
            self.send_response(404)
            self.end_headers()
            print("Served 404")

def run_server():
    try:
        server = HTTPServer(('127.0.0.1', 5174), TestHandler) # Use 5174 to avoid conflict
        print("Server started on 5174")
        server.serve_forever()
    except Exception as e:
        print(f"Server error: {e}")

thread = threading.Thread(target=run_server, daemon=True)
thread.start()

time.sleep(2)

print("Testing request to http://127.0.0.1:5174/index.html")
try:
    resp = requests.get("http://127.0.0.1:5174/index.html")
    print(f"Status: {resp.status_code}")
    print(f"Length: {len(resp.content)}")
    if resp.status_code == 200:
        print("Success!")
except Exception as e:
    print(f"Request failed: {e}")
