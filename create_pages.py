import os

DEST_DIR = r"c:\Users\Aarav Kushwaha\Desktop\horizon.in\public"
os.makedirs(DEST_DIR, exist_ok=True)

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | Horizon Desk</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {{
            --bg: #ffffff;
            --text: #000000;
            --primary: #ffffff;
            --accent: #d4e157; /* Lime Green */
            --accent2: #ff9fbB; /* Soft Pink */
            --border: 4px solid #000000;
            --shadow: 8px 8px 0px #000000;
            --shadow-hover: 12px 12px 0px #000000;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }}
        body {{ background-color: var(--bg); color: var(--text); padding-top: 100px; overflow-x: hidden; }}
        
        header {{
            position: fixed; top: 0; left: 0; right: 0;
            background: var(--bg); border-bottom: var(--border);
            padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; z-index: 1000;
        }}
        .logo {{ font-size: 2.2rem; font-weight: 800; letter-spacing: -2px; text-transform: uppercase; color: #000; text-decoration: none; display: flex; align-items: center; gap: 10px; }}
        .nav-links {{ display: flex; gap: 24px; align-items: center; }}
        .nav-links a {{ color: var(--text); text-decoration: none; font-weight: 800; font-size: 1.1rem; border: 3px solid transparent; padding: 8px 16px; transition: all 0.2s; text-transform: uppercase; }}
        .nav-links a:hover {{ border: 3px solid #000; background: var(--accent); box-shadow: 4px 4px 0px #000; transform: translate(-2px, -2px);}}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 60px 20px; }}
        
        .hero {{ min-height: 40vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; margin-bottom: 20px; }}
        .hero h1 {{ font-size: 5rem; font-weight: 800; line-height: 1; margin-bottom: 30px; text-transform: uppercase; letter-spacing: -3px; background: var(--accent2); display: inline-block; padding: 5px 20px; border: var(--border); box-shadow: var(--shadow); }}
        .hero p {{ font-size: 1.5rem; font-weight: 600; max-width: 800px; line-height: 1.4; }}
        
        .content-section {{ border: var(--border); box-shadow: var(--shadow); background: #fff; padding: 60px; margin-bottom: 60px; }}
        .content-section h2 {{ font-size: 2.5rem; font-weight: 800; text-transform: uppercase; margin-bottom: 30px; border-bottom: 4px solid #000; padding-bottom: 10px; display: inline-block; }}
        .content-section p {{ font-size: 1.25rem; font-weight: 500; margin-bottom: 20px; line-height: 1.6; }}
        .content-section ul {{ list-style: none; margin-top: 30px; }}
        .content-section li {{ font-size: 1.3rem; font-weight: 600; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 15px; border-left: 5px solid var(--accent); padding-left: 20px; }}
        .content-section i {{ font-size: 1.8rem; color: #000; margin-top: 2px; }}

        .btn {{
            font-size: 1.2rem; font-weight: 800; text-decoration: none; text-transform: uppercase;
            padding: 16px 32px; color: var(--text); background: var(--primary);
            border: var(--border); box-shadow: var(--shadow); transition: all 0.2s ease; cursor: pointer;
            display: inline-flex; align-items: center; gap: 12px; margin-top: 30px;
        }}
        .btn:hover {{ transform: translate(-4px, -4px); box-shadow: var(--shadow-hover); background: var(--accent); }}

        footer {{ border-top: var(--border); padding: 40px 20px; text-align: center; font-weight: 800; margin-top: 100px; background: var(--accent2); }}
        
        @media (max-width: 768px) {{
            .hero h1 {{ font-size: 3rem; }}
            .nav-links {{ display: none; }}
            .content-section {{ padding: 30px; }}
        }}
    </style>
</head>
<body>
    <header>
        <a href="index.html" class="logo">
            <img src="512-icon-5.png" alt="Horizon Logo" style="height: 40px; border-radius: 8px;">HORIZON
        </a>
        <div class="nav-links">
            <a href="index.html">Home</a>
            <a href="user.html">For Users</a>
            <a href="Why.html">For Developers</a>
        </div>
    </header>

    <div class="container hero">
        <h1>{hero_title}</h1>
        <p>{hero_subtitle}</p>
    </div>

    <div class="container content-section">
        {content_html}
    </div>

    <footer>
        <p>© 2026 HORIZON DESK SOFTWARE</p>
    </footer>
</body>
</html>
"""

why_html = TEMPLATE.format(
    title="For Developers",
    hero_title="Build The Future",
    hero_subtitle="Horizon Desk provides the most robust orchestration layer for automating the Windows Desktop environment. Period.",
    content_html="""
        <h2>Why Developers Choose Horizon</h2>
        <p>Horizon Desk isn't just an app—it's a developer platform designed to sit entirely locally on a user's machine, running autonomous AI logic with direct system access. Here is why you should build your next automation tool as a Horizon Plugin:</p>
        
        <ul>
            <li>
                <i class="fas fa-terminal"></i>
                <div>
                    <strong>Pure Python Automation:</strong> Write raw, powerful Python scripts. Forget sandboxed web extensions; you have full access to `psutil`, `os`, `shutil`, and network sockets out of the box.
                </div>
            </li>
            <li>
                <i class="fas fa-brain"></i>
                <div>
                    <strong>OmniAgent Routing:</strong> You don't need to write LLM prompt loops. Just define a Python class inheriting from `BaseTool`, give it a description, and the Horizon OmniAgent handles the NLP reasoning to trigger your function precisely when needed.
                </div>
            </li>
            <li>
                <i class="fas fa-boxes"></i>
                <div>
                    <strong>1-Command Scaffolding:</strong> The <code>horizondesk-sdk</code> CLI scaffolds, tests, installs, and publishes your plugins instantly. Test your code visually via the built-in GUI Workshop before deploying.
                </div>
            </li>
            <li>
                <i class="fas fa-store"></i>
                <div>
                    <strong>Instant Distribution:</strong> Tap into a native marketplace instantly. Distribute your enterprise integrations or smart home hacks directly to users seamlessly.
                </div>
            </li>
        </ul>

        <a href="docs.html" class="btn"><i class="fas fa-book"></i> Read the Docs</a>
    """
)

user_html = TEMPLATE.format(
    title="For Users",
    hero_title="Work Smarter.",
    hero_subtitle="Stop repeating menial software tasks. Let an advanced AI workflow engine take over the heavy lifting.",
    content_html="""
        <h2>Why Users Choose Horizon</h2>
        <p>Horizon Desk works silently in the background of your Windows computer. By hooking directly into your operating system, it can automate any task you give it through plain English. Here is why thousands rely on Horizon Desk every day:</p>
        
        <ul>
            <li>
                <i class="fas fa-magic"></i>
                <div>
                    <strong>Natural Language Control:</strong> You don't need to learn a programming language or complex macro recorders. Just type "Resize all the images on my desktop to 1080p and email them to John" and watch it happen.
                </div>
            </li>
            <li>
                <i class="fas fa-puzzle-piece"></i>
                <div>
                    <strong>Endless Ecosystem:</strong> Thanks to the Horizon Plugin Store, you can install independent modules that connect your agent to your Smart Home, your external APIs, your Finance software, and more. 
                </div>
            </li>
            <li>
                <i class="fas fa-shield-alt"></i>
                <div>
                    <strong>Privacy First & Secure Executions:</strong> The agent pauses for confirmation on destructive tasks, and OAuth credentials are mathematically sealed inside your OS keystore.
                </div>
            </li>
            <li>
                <i class="fas fa-tachometer-alt"></i>
                <div>
                    <strong>Always-On Background Daemon:</strong> Never wait for a web browser page to load. Tap your global hotkey to instantly wake the assistant overlay over any app you’re currently working in.
                </div>
            </li>
        </ul>

        <a href="https://horizon-release.t3.storage.dev/HorizonDesk_v0.2_Setup.exe" class="btn" style="background: var(--accent2);"><i class="fas fa-download"></i> Download Horizon</a>
    """
)

with open(os.path.join(DEST_DIR, "Why.html"), "w", encoding="utf-8") as f:
    f.write(why_html)

with open(os.path.join(DEST_DIR, "user.html"), "w", encoding="utf-8") as f:
    f.write(user_html)
    
print("Successfully generated Why.html and user.html")
