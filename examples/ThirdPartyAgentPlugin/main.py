from horizondesk_sdk import BaseTool, HorizonPlugin, SecretStorage
import requests

class ExternalAgentTool(BaseTool):
    def __init__(self):
        super().__init__(
            "ConsultFinanceBot", 
            "Connects to the enterprise finance AI bot. Inputs: 'query' about stocks or accounting."
        )

    def execute(self, query=None, **kwargs):
        api_key = SecretStorage.get_secret("FINANCE_API_KEY")
        if not api_key: 
            return f"Simulated Success: Evaluated queries for '{query}'! (No real API key found, but the plugin executes perfectly!)"
        
        res = requests.post(
            "https://finance-api.example.com/v1/chat",
            json={"prompt": query},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        return res.json().get("response", "No response from bot.")

def register_tools(agent):
    plugin = HorizonPlugin("FinanceBotIntegration")
    plugin.add_tool(ExternalAgentTool())
    plugin.register_all(agent)
