from core.tools import BaseTool
import requests
from bs4 import BeautifulSoup
import urllib.parse
import re

class UnsplashSearchTool(BaseTool):
    """
    Search Unsplash for high-quality, royalty-free images.
    Returns a list of image URLs in markdown format.
    """
    def __init__(self):
        super().__init__(
            "UnsplashSearch",
            "Search for high-quality photos on Unsplash. Input: JSON with 'query'."
        )

    def execute(self, query=None, payload=None):
        q = query or (payload.get('query') if isinstance(payload, dict) else payload)
        if not q:
            return "Error: No query provided."

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            }
            url = f"https://unsplash.com/s/photos/{urllib.parse.quote(str(q))}"
            res = requests.get(url, headers=headers, timeout=15)
            
            if res.status_code != 200:
                return f"Unsplash search failed with HTTP {res.status_code}."

            soup = BeautifulSoup(res.text, "html.parser")
            
            # Unsplash usually uses <img> tags with a specific srcset or src
            # We look for images that are large enough to be the main photos
            images = []
            img_tags = soup.find_all('img')
            
            for img in img_tags:
                src = img.get('src', '')
                # Filter out small avatars or icons. Real photos have 'images.unsplash.com/photo-'
                if "images.unsplash.com/photo-" in src:
                    # Clean the URL to get a decent resolution but not too massive
                    # We want something like w=600 for the preview
                    clean_src = re.sub(r'\?.*$', '', src)
                    final_url = f"{clean_src}?auto=format&fit=crop&q=80&w=800"
                    
                    alt = img.get('alt', 'Unsplash photo')
                    images.append(f"![{alt}]({final_url})")
                    
                    if len(images) >= 3:
                        break

            if not images:
                return "No high-quality images found on Unsplash for this query."

            return "\n\n".join(images)

        except Exception as e:
            return f"Unsplash Search Error: {e}"
