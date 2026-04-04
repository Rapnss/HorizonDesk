from horizondesk_sdk import BaseTool, HorizonPlugin

class CalculatorTool(BaseTool):
    def __init__(self):
        super().__init__("SimpleCalculator", "Evaluates a basic math expression. Input: 'expression'.")

    def execute(self, expression="", **kwargs):
        try:
            # DANGER: For demonstration only. In production, use a safe evaluator!
            result = eval(str(expression))
            return f"The result of {expression} is {result}"
        except Exception as e:
            return f"Could not calculate {expression}. Error: {e}"

def register_tools(agent):
    plugin = HorizonPlugin("SamplePlugin")
    plugin.add_tool(CalculatorTool())
    
    # Register the tools to the active agent
    plugin.register_all(agent)
