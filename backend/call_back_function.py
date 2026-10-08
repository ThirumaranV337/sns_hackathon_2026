from agent_tools import detail_collecting_agent

from agents import Runner

import json
from IPython.display import display, Markdown

import tracing
def extract_text(output_data):
    """Normalize whatever final_output comes back as into a plain string."""
    if output_data is None:
        return ""
    if isinstance(output_data, str):
        return output_data.strip()
    if isinstance(output_data, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in output_data
        ).strip()
    if hasattr(output_data, "model_dump_json"):
        return output_data.model_dump_json()
    return str(output_data).strip()


async def callback(message, history):
    debug_lines = []
    try:
        full_payload = []
        for msg in history:
            if isinstance(msg, dict):
                role = msg.get("role")
                content = msg.get("content")
            else:
                role = msg.role
                content = msg.content
            full_payload.append({"role": role, "content": extract_text(content)})

        full_payload.append({"role": "user", "content": message})

        result = await Runner.run(
            starting_agent=detail_collecting_agent,
            input=full_payload,
            max_turns=20,
        )

        # Debug trace: show every tool call the agent made this turn
        if getattr(result, "new_items", None):
            for item in result.new_items:
                item_type = getattr(item, "type", None)
                debug_lines.append(f"item type: {item_type}")
                if item_type == "tool_call_item":
                    raw_call = getattr(item, "raw_item", None)
                    call_name = getattr(raw_call, "name", None)
                    print(f"\n\U0001F680 [LOG] Tool called: {call_name}")
                    if call_name == "email_creater":
                        raw_args = getattr(raw_call, "arguments", "{}")
                        try:
                            parsed_args = json.loads(raw_args)
                        except (TypeError, json.JSONDecodeError):
                            parsed_args = raw_args
                        payload_sent = (
                            parsed_args.get("data")
                            if isinstance(parsed_args, dict)
                            else parsed_args
                        )
                        display(Markdown(f"### Sent Data Payload:\n{payload_sent}"))
                elif item_type == "tool_call_output_item":
                    tool_output = getattr(item, "output", None)
                    if tool_output is not None:
                        print("\U0001F4EC [LOG] Tool output received:")
                        display(Markdown(f"```\n{tool_output}\n```"))

        output_data = extract_text(result.final_output)

        if not output_data:
            debug_dump = "\n".join(debug_lines) if debug_lines else "no new_items recorded"
            return (
                "\u26a0\ufe0f The agent finished this turn but produced no reply text.\n\n"
                f"Debug — items seen: {debug_dump}\n"
                f"final_output was: {result.final_output!r}"
            )

        return output_data

    except Exception as e:
        return f"Error executing pipeline: {str(e)}\n\nDebug so far: {debug_lines}"