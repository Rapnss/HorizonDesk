from horizondesk_sdk import BaseTool, HorizonPlugin
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
    
    plugin.register_all(agent)