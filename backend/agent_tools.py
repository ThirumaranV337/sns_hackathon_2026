from dotenv import load_dotenv
import json
import requests
from agents import Agent, Runner, trace, function_tool, ModelSettings,OpenAIChatCompletionsModel
from openai.types.responses import ResponseTextDeltaEvent
from sqlalchemy import func, select
from sqlalchemy.orm import Session
import os
import asyncio
import smtplib
from email.message import EmailMessage
from openai import AsyncOpenAI
import requests
from instructions_for_agents import instruction
from  email_tools  import email_creater
from data_model_complaint import (
    USER_ID,
    UserComplaint,
    UserComplaintCreate,
    UserComplaintRead,
    engine,
)


"""Setting the agent one a detail collector"""
instruction_for_detail_collector=instruction.instruction_for_detail_collector
load_dotenv(override=True)
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
groq_api_key = os.getenv('GROQ_API_KEY')
groq_client = AsyncOpenAI(base_url=GROQ_BASE_URL, api_key=groq_api_key)
qwen_model = OpenAIChatCompletionsModel(model="openai/gpt-oss-120b", openai_client=groq_client)


def _validate_tool_user_id(user_id: int) -> None:
    if user_id != USER_ID:
        raise ValueError(f"This prototype only supports user ID {USER_ID}.")


def _get_complaint_summary(user_id: int = USER_ID) -> dict[str, object]:
    _validate_tool_user_id(user_id)
    with Session(engine) as session:
        user_complaints = UserComplaint.user_id == user_id
        total = session.scalar(
            select(func.count()).select_from(UserComplaint).where(user_complaints)
        )
        categories = session.execute(
            select(UserComplaint.category, func.count(UserComplaint.id))
            .where(user_complaints)
            .group_by(UserComplaint.category)
            .order_by(UserComplaint.category)
        ).all()
        statuses = session.execute(
            select(UserComplaint.status, func.count(UserComplaint.id))
            .where(user_complaints)
            .group_by(UserComplaint.status)
            .order_by(UserComplaint.status)
        ).all()

    return {
        "total_complaints": total,
        "by_category": [
            {"category": category, "count": count}
            for category, count in categories
        ],
        "by_status": [
            {"status": status, "count": count}
            for status, count in statuses
        ],
    }


@function_tool
def fetch_complaint_summary(user_id: int) -> str:
    """Return total complaint counts grouped by category and status, without personal details."""
    return json.dumps(_get_complaint_summary(user_id))


def _save_user_complaint(payload: UserComplaintCreate) -> UserComplaintRead:
    with Session(engine) as session:
        complaint = UserComplaint(
            user_id=USER_ID,
            **payload.model_dump(),
        )
        session.add(complaint)
        session.flush()
        session.refresh(complaint)
        saved_complaint = UserComplaintRead.model_validate(complaint)
        session.commit()

    return saved_complaint


def _get_user_complaints(user_id: int = USER_ID) -> list[UserComplaintRead]:
    _validate_tool_user_id(user_id)
    with Session(engine) as session:
        complaints = session.scalars(
            select(UserComplaint)
            .where(UserComplaint.user_id == user_id)
            .order_by(UserComplaint.id.desc())
        ).all()

    return [UserComplaintRead.model_validate(complaint) for complaint in complaints]


@function_tool
def save_user_complaint(payload: UserComplaintCreate) -> str:
    """Save a successfully submitted complaint for the configured user."""
    return _save_user_complaint(payload).model_dump_json()


@function_tool
def fetch_user_complaints(user_id: int) -> str:
    """Retrieve the configured user's filed complaints, including their submitted details."""
    return json.dumps(
        [complaint.model_dump() for complaint in _get_user_complaints(user_id)]
    )


detail_collecting_agent = Agent(
    name="Details Collection Agent",
    instructions=instruction_for_detail_collector,
    tools=[
        email_creater,
        save_user_complaint,
        fetch_user_complaints,
        fetch_complaint_summary,
    ],
    model=qwen_model,
    model_settings=ModelSettings(
        extra_body={"reasoning_effort": "high"},
        max_tokens=4000
    )
)
class tool_agent:
    detail_collecting_agent = detail_collecting_agent
