import os

DEST_DIR = r"c:\Users\Aarav Kushwaha\Desktop\horizon.in\public\plugin-examples"
os.makedirs(DEST_DIR, exist_ok=True)

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Horizon Desk Plugin SDK</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg: #ffffff;
            --text: #000000;
            --accent: #ff4081; 
            --accent2: #d4e157;
            --border: 4px solid #000000;
            --shadow: 8px 8px 0px #000000;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }}
        body {{ background-color: var(--bg); color: var(--text); padding-top: 80px; }}
        
        header {{
            position: fixed; top: 0; left: 0; right: 0;
            background: var(--bg); border-bottom: var(--border);
            padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; z-index: 1000;
        }}
        .logo {{ font-size: 2.2rem; font-weight: 800; letter-spacing: -2px; text-transform: uppercase; color: #000; text-decoration: none; }}
        .nav-links a {{ color: var(--text); text-decoration: none; font-weight: 800; font-size: 1.1rem; border: 3px solid transparent; padding: 8px 16px; margin-left: 10px; transition: all 0.2s; text-transform: uppercase; }}
        .nav-links a:hover, .nav-links a.active {{ border: 3px solid #000; background: var(--accent); color: #fff; box-shadow: 4px 4px 0px #000; transform: translate(-2px, -2px); }}
        
        .container {{ max-width: 900px; margin: 60px auto; padding: 40px; border: var(--border); box-shadow: var(--shadow); background: #fff; }}
        h1 {{ font-size: 3rem; font-weight: 800; text-transform: uppercase; margin-bottom: 24px; background: var(--accent2); display: inline-block; padding: 0 16px; border: var(--border); box-shadow: 4px 4px 0px #000; }}
        h2 {{ font-size: 2rem; margin-top: 32px; margin-bottom: 16px; text-transform: uppercase; border-bottom: 3px solid #000; padding-bottom: 8px; }}
        p {{ font-size: 1.2rem; font-weight: 600; margin-bottom: 24px; line-height: 1.6; }}
        
        pre {{ background: #000; color: #fff; padding: 24px; font-weight: bold; border: var(--border); box-shadow: 8px 8px 0px var(--accent); margin: 32px 0; overflow-x: auto; }}
        code {{ font-family: monospace; font-size: 1.1rem; }}
        
        .back-btn {{ display: inline-block; text-decoration: none; color: #fff; background: #000; font-weight: 800; padding: 12px 24px; border: var(--border); margin-bottom: 32px; box-shadow: 4px 4px 0px var(--accent2); transition: transform 0.2s; }}
        .back-btn:hover {{ transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--accent2); }}
    </style>
</head>
<body>
    <header>
        <a href="../index.html" class="logo">HORIZON</a>
        <div class="nav-links">
            <a href="../docs.html" class="active">SDK Docs</a>
            <a href="../api.html">API</a>
        </div>
    </header>

    <div class="container">
        <a href="../docs.html" class="back-btn">&larr; Back to Docs</a>
        <h1>{title}</h1>
        <p>{description}</p>
        
        <h2>Plugin Structure</h2>
        <p>You will need your standard <code>horizon_plugin.raf</code> and your main python script containing your custom logic.</p>

        <h2>Python Implementation (main.py)</h2>
        <pre><code>{code}</code></pre>

        <h2>How to Install & Test</h2>
        <p>Run the following SDK command from your plugin directory to test it directly in your Horizon Desk application:</p>
        <pre><code>horizondesk-sdk install</code></pre>
    </div>
</body>
</html>
"""

pages = [
    {
        "filename": "third-party-agent.html",
        "title": "Third-Party Agent Integration",
        "description": "Expose an external AI, like a customer support chatbot or specialized research model, directly as a tool within Horizon Desk. The OmniAgent will consult your third-party API whenever it needs specialized assistance.",
        "code": """from horizondesk_sdk import BaseTool, HorizonPlugin, SecretStorage
import requests

class ExternalAgentTool(BaseTool):
    def __init__(self):
        super().__init__(
            "ConsultFinanceBot", 
            "Connects to the enterprise finance AI bot. Inputs: 'query' about stocks or accounting."
        )

    def execute(self, query=None, **kwargs):
        # Always use SecretStorage to retrieve API keys securely!
        api_key = SecretStorage.get_secret("FINANCE_API_KEY")
        if not api_key: return "Error: FINANCE_API_KEY not found in secrets."
        
        res = requests.post(
            "https://finance-api.example.com/v1/chat",
            json={"prompt": query},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        return res.json().get("response", "No response from bot.")

def register_tools(agent):
    plugin = HorizonPlugin("FinanceBotIntegration")
    plugin.add_tool(ExternalAgentTool())
    plugin.register_all(agent)"""
    },
    {
        "filename": "finance-ui.html",
        "title": "Finance UI Integration",
        "description": "Inject a completely new native GUI tab into the Horizon Desk frontend via PyWebView. This plugin adds a 'Bills Setup' tab seamlessly.",
        "code": """from horizondesk_sdk import BaseTool, HorizonPlugin
import json
import os

class AddBillTool(BaseTool):
    def __init__(self):
        super().__init__("AddMonthlyBill", "Saves a recurring bill to the database. Input: 'amount', 'payee', 'due_date'")

    def execute(self, amount, payee, due_date, **kwargs):
        # Interact strictly with the backend database
        bills_db = os.path.join(os.environ["USERPROFILE"], "HorizonDesktop", "bills.json")
        bills = []
        if os.path.exists(bills_db):
            bills = json.load(open(bills_db))
        
        bills.append({"amount": amount, "payee": payee, "due_date": due_date})
        with open(bills_db, 'w') as f:
            json.dump(bills, f)
            
        return f"Successfully recorded a ${amount} bill for {payee} on the {due_date}."

def register_tools(agent):
    plugin = HorizonPlugin("FinanceBillsUI")
    plugin.add_tool(AddBillTool())
    
    # Advanced: Inject a React Component tab into the Desktop UI dynamically
    # agent.gui_injector.add_tab("Finance", "finance_component.js")
    
    plugin.register_all(agent)"""
    },
    {
        "filename": "system-cleaner.html",
        "title": "System Cleaner & Automation",
        "description": "Give your agent the power to orchestrate local Python and shell commands safely. This plugin adds a Windows Temp folder cleaner.",
        "code": """from horizondesk_sdk import BaseTool, HorizonPlugin
import os
import shutil
import tempfile

class CleanTempTool(BaseTool):
    def __init__(self):
        super().__init__("CleanWindowsTemp", "Deletes temporary cache files on Windows safely.")

    def execute(self, **kwargs):
        temp_dir = tempfile.gettempdir()
        del_count = 0
        for item in os.listdir(temp_dir):
            item_path = os.path.join(temp_dir, item)
            try:
                if os.path.isfile(item_path):
                    os.remove(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                del_count += 1
            except Exception:
                pass # Skip locked files
                
        return f"System clean complete. Recovered space by removing {del_count} items from Temp."

def register_tools(agent):
    plugin = HorizonPlugin("SystemOSCleaner")
    plugin.add_tool(CleanTempTool())
    plugin.register_all(agent)"""
    },
    {
        "filename": "smarthome-iot.html",
        "title": "Smart Home IoT Control",
        "description": "Connect the Horizon Agent to your local network devices. Ask your computer to 'dim the lights' and watch it happen.",
        "code": """from horizondesk_sdk import BaseTool, HorizonPlugin
import requests

class SmartLightTool(BaseTool):
    def __init__(self):
        super().__init__("ControlHueLights", "Changes the brightness of IoT smart lights. Inputs: 'brightness' (0-100)")

    def execute(self, brightness, **kwargs):
        # Local network communication
        bridge_ip = "192.168.1.50" 
        username = "api-user-token"
        
        data = {"bri": int(brightness * 2.54)} # Scale 100 to 254
        
        try:
            requests.put(f"http://{bridge_ip}/api/{username}/groups/1/action", json=data)
            return f"Lights adjusted to {brightness}%"
        except Exception as e:
            return f"Failed to reach lighting bridge: {e}"

def register_tools(agent):
    plugin = HorizonPlugin("PhilipsHueBridge")
    plugin.add_tool(SmartLightTool())
    plugin.register_all(agent)"""
    },
    {
        "filename": "email-automation.html",
        "title": "Automated Email Sequences",
        "description": "Let your agent draft, authorize, and send emails continuously using SMTP. Useful for marketing automation.",
        "code": """from horizondesk_sdk import BaseTool, HorizonPlugin, SecretStorage
import smtplib
from email.message import EmailMessage

class SendEmailTool(BaseTool):
    def __init__(self):
        super().__init__("SendAutomatedEmail", "Sends an email securely. Inputs: 'recipient', 'subject', 'body'")

    def execute(self, recipient, subject, body, **kwargs):
        pw = SecretStorage.get_secret("SMTP_PASSWORD")
        email = SecretStorage.get_secret("SMTP_EMAIL")
        
        msg = EmailMessage()
        msg.set_content(body)
        msg['Subject'] = subject
        msg['From'] = email
        msg['To'] = recipient
        
        try:
            server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
            server.login(email, pw)
            server.send_message(msg)
            server.quit()
            return f"Sent email '{subject}' to {recipient}."
        except Exception as e:
            return f"Failed to send: {e}"

def register_tools(agent):
    plugin = HorizonPlugin("EmailAutomator")
    plugin.add_tool(SendEmailTool())
    plugin.register_all(agent)"""
    },
    {
        "filename": "database-sync.html",
        "title": "Remote Database Sycnronization",
        "description": "A plugin to safely fetch and mutate Postgres or Turso databases based on natural language requests.",
        "code": """from horizondesk_sdk import BaseTool, HorizonPlugin, SecretStorage
import sqlite3 # Or psycopg2

class QueryDatabaseTool(BaseTool):
    def __init__(self):
        super().__init__("QuerySalesDatabase", "Runs an SQL SELECT query on the sales database strictly safely. Input: 'query'")

    def execute(self, query, **kwargs):
        # Basic SQL Injection protection for READ-ONLY tools
        if "DROP" in query.upper() or "DELETE" in query.upper():
            return "Execution aborted. This tool is read-only."
            
        try:
            db_path = "sales_replica.db"
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(query)
            results = cursor.fetchall()
            conn.close()
            return f"Query returned: {results}"
        except Exception as e:
            return f"Database query failed: {e}"

def register_tools(agent):
    plugin = HorizonPlugin("DataSyncronization")
    plugin.add_tool(QueryDatabaseTool())
    plugin.register_all(agent)"""
    }
]

for page in pages:
    path = os.path.join(DEST_DIR, page["filename"])
    content = TEMPLATE.format(**page)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Successfully generated all sample pages.")
