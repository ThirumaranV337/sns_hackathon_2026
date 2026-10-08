import os
import json

import requests
from dotenv import load_dotenv
from agents import Agent, Runner, function_tool, ModelSettings, OpenAIChatCompletionsModel
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from instructions_for_agents import instruction

load_dotenv(override=True)

pushover_user = os.getenv("PUSHOVER_USER")
pushover_token = os.getenv("PUSHOVER_TOKEN")
pushover_url = "https://api.pushover.net/1/messages.json"

"""The tool email generator agent """
instruction_for_detail_collector=instruction.instruction_for_detail_collector
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
groq_api_key = os.getenv('GROQ_API_KEY')
groq_client = AsyncOpenAI(base_url=GROQ_BASE_URL, api_key=groq_api_key)
qwen_model = OpenAIChatCompletionsModel(model="moonshotai/kimi-k2-instruct-0905", openai_client=groq_client)


def push(message: str) -> None:
    if not pushover_user or not pushover_token:
        raise RuntimeError(
            "Pushover is not configured; set PUSHOVER_USER and PUSHOVER_TOKEN."
        )

    payload = {"user": pushover_user, "token": pushover_token, "message": message}
    response = requests.post(pushover_url, data=payload, timeout=10)
    response.raise_for_status()

    result = response.json()
    if not isinstance(result, dict) or result.get("status") != 1:
        errors = result.get("errors", []) if isinstance(result, dict) else []
        detail = "; ".join(str(error) for error in errors) or "unknown API error"
        raise RuntimeError(f"Pushover rejected the notification: {detail}")


@function_tool
def send_sgrc_complaint(report: str):
    """
    Sends the complaint report to the Student Grievance Redressal Committee (SGRC).

    Handles academic and administrative grievances such as:
    - Internal marks
    - Attendance
    - Faculty misconduct
    - Examination issues
    - Fee-related issues
    - Certificates
    - Laboratory facilities
    - Library issues
    - Infrastructure problems
    - Timetable issues
    """
    push(report)
    return "The report was sent successfully via Pushover."
@function_tool
def send_anti_ragging_complaint(report: str):
    """
    Sends the complaint report to the Anti-Ragging Committee.

    Handles complaints involving:
    - Physical ragging
    - Verbal abuse
    - Mental harassment
    - Senior intimidation
    - Hostel ragging
    - Cyber ragging
    - Bullying
    - Threats
    - Forced activities
   """
    push(report)
    return "The report was sent successfully via Pushover."
@function_tool
def send_icc_posh_complaint(report: str):
    """
    Sends the complaint report to the Internal Complaints Committee (ICC/POSH).

    Handles complaints related to:
    - Sexual harassment
    - Stalking
    - Unwanted physical contact
    - Inappropriate messages
    - Sexual comments
    - Gender-based harassment
    - Online harassment
    - Blackmail
    """
    push(report)
    return "The report was sent successfully via Pushover."
@function_tool
def send_scst_cell_complaint(report: str):
    """
    Sends the complaint report to the SC/ST Cell.

    Handles complaints involving:
    - Caste discrimination
    - Reservation issues
    - Scholarship problems
    - Biased treatment
    - Offensive caste remarks
    - Social exclusion
    - Hostel discrimination
    """
    push(report)
    return "The report was sent successfully via Pushover."
@function_tool
def send_equal_opportunity_cell_complaint(report: str):
    """
    Sends the complaint report to the Equal Opportunity Cell (EOC).

    Handles complaints related to:
    - Disability support
    - Accessibility issues
    - Religious discrimination
    - Language discrimination
    - Gender equality
    - Economic discrimination
    - Equal opportunity concerns
    """
    push(report)
    return "The report was sent successfully via Pushover."
@function_tool
def send_women_empowerment_cell_complaint(report: str):
    """
    Sends the complaint report to the Women Empowerment Cell.

    Handles complaints involving:
    - Women's safety
    - Eve teasing
    - Unsafe campus
    - Unsafe hostel
    - Unsafe transportation
    - Counseling requests
    - Women's welfare
    - Security concerns
    """
    push(report)
    return "The report was sent successfully via Pushover."
@function_tool
def send_hostel_grievance_complaint(report: str):
    """
    Sends the complaint report to the Hostel Grievance and Welfare Cell.

    Handles complaints related to:
    - Hostel facilities
    - Food quality
    - Room allocation
    - Water supply
    - Electricity
    - Cleanliness
    - Hostel security
    - Warden misconduct
    - Roommate conflicts
    - Theft
    - Hostel maintenance
    """
    push(report)
    return "The report was sent successfully via Pushover."
class EmailPayload(BaseModel):
    data: str = Field(
    description="A unified, concise text block or paragraph summarizing all gathered complaint details. Do NOT pass nested JSON objects."
    )

tools=[send_sgrc_complaint,send_anti_ragging_complaint,send_icc_posh_complaint,send_scst_cell_complaint,send_equal_opportunity_cell_complaint,send_women_empowerment_cell_complaint,send_hostel_grievance_complaint]

# Define the model and agent ONCE, outside the function — not on every call
email_model = OpenAIChatCompletionsModel(
    model="openai/gpt-oss-20b",
    openai_client=groq_client
)

email_creater_agent = Agent(
    name="Complaint routing and notification agent",
    instructions=instruction.instruction_for_email_generator,
    tools=tools,  # your actual send-email tool(s)
    model=email_model,
    model_settings=ModelSettings(
        extra_body={"reasoning_effort": "high"},
        max_tokens=1500
    )
)

escalation_report_agent = Agent(
    name="Complaint Escalation Report Agent",
    instructions=(
        "Write a concise, formal escalation report for the higher authorities. "
        "Explain that the student reports their complaint has not received "
        "attention from the responsible authorities and is now being escalated "
        "for review. Include the complaint ID, submission date, title, category, "
        "current status, and all supplied complaint details. Do not invent facts "
        "or claim that an investigation has established anything. Preserve "
        "confidentiality and use only the information supplied. Return only the "
        "plain-text report that can be sent to the relevant committee."
    ),
    model=email_model,
    model_settings=ModelSettings(
        extra_body={"reasoning_effort": "high"},
        max_tokens=1500,
    ),
)

request_description_agent = Agent(
    name="Student Request Description Editor",
    instructions=(
        "Rewrite the student's OD or leave request description in clear, "
        "grammatically correct, professional English. For a long input, "
        "organize the key information into a brief, well-structured description; "
        "for a short input, provide enough detail to make it clear without "
        "padding or inventing information. Preserve the student's original "
        "meaning, facts, dates, and level of certainty. Do not add reasons, "
        "medical details, events, or other facts that the student did not "
        "provide. Keep it in first person where appropriate. The complete "
        "rewritten description must always be fewer than 150 words. Before "
        "responding, check its word count and shorten it if needed. Return only "
        "the improved description, with no heading, explanation, or quotation "
        "marks."
    ),
    model=email_model,
    model_settings=ModelSettings(
        extra_body={"reasoning_effort": "medium"},
        max_tokens=700,
    ),
)


def extract_text(final_output):
    if final_output is None:
        return ""
    if isinstance(final_output, str):
        return final_output
    if hasattr(final_output, "model_dump_json"):
        return final_output.model_dump_json()
    if isinstance(final_output, list):
        parts = []
        for item in final_output:
            if isinstance(item, str):
                parts.append(item)
            elif hasattr(item, "text"):
                parts.append(item.text)
            else:
                parts.append(str(item))
        return "".join(parts)
    return str(final_output)


async def generate_escalation_report(complaint: dict[str, object]) -> str:
    result = await Runner.run(
        starting_agent=escalation_report_agent,
        input=json.dumps(complaint, ensure_ascii=False),
    )
    report = extract_text(result.final_output).strip()
    if not report:
        raise RuntimeError("The escalation report agent returned an empty report.")
    return report


async def rewrite_request_description(description: str) -> str:
    result = await Runner.run(
        starting_agent=request_description_agent,
        input=description,
    )
    rewritten = extract_text(result.final_output).strip()
    if not rewritten:
        raise RuntimeError("The description editor returned an empty response.")
    return rewritten


async def deliver_escalation_report(report: str) -> None:
    result = await Runner.run(
        starting_agent=email_creater_agent,
        input=[{"role": "user", "content": EmailPayload(data=report).model_dump_json()}],
    )
    output = extract_text(result.final_output).strip()
    if not output:
        raise RuntimeError("The complaint routing agent returned no delivery status.")
    try:
        delivery_result = json.loads(output)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            "The complaint routing agent returned an invalid delivery status."
        ) from error
    if not isinstance(delivery_result, dict) or delivery_result.get("status") != "success":
        reason = (
            delivery_result.get("error", "The notification was not delivered.")
            if isinstance(delivery_result, dict)
            else "The notification was not delivered."
        )
        raise RuntimeError(str(reason))


@function_tool
async def email_creater(payload: EmailPayload):
    """Classify the complaint, then notify the appropriate committee via Pushover."""
    try:
        # Serialize the structured payload into a message the agent can act on
        input_message = [
            {"role": "user", "content": payload.model_dump_json()}
        ]

        result = await Runner.run(
            starting_agent=email_creater_agent,
            input=input_message
        )

        output = extract_text(result.final_output)

        if not output:
            return (
                '{"status": "failure", "error": '
                '"Email agent returned an empty response; delivery status is unknown"}'
            )
        return output

    except Exception as e:
        return json.dumps({"status": "failure", "error": str(e)})
