import json
import logging
import os
import re
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from data_model_complaint import USER_ID, UserComplaint, UserComplaintCreate, engine

load_dotenv()


class ComplaintSubmission(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    category: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=200)
    date: str
    severity: Literal["Low", "Medium", "High", "Critical"]
    attachment: str = ""
    cell: str = Field(min_length=1, max_length=100)
    sla: int = Field(gt=0)
    created: int = Field(gt=0)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class DescriptionRewriteRequest(BaseModel):
    description: str = Field(min_length=1, max_length=5000)


ESCALATION_WAIT_DAYS = 3
RESOLVED_STATUSES = {"resolved", "closed", "escalated"}
logger = logging.getLogger(__name__)


app = FastAPI(title="CampusFlow API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:4173,http://localhost:4173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


def _escalation_days_remaining(complaint: UserComplaint, today: date) -> int:
    return max(
        0,
        (complaint.complaint_date + timedelta(days=ESCALATION_WAIT_DAYS) - today).days,
    )


def _complaint_response(
    complaint: UserComplaint, today: date | None = None
) -> dict[str, object]:
    today = today or date.today()
    try:
        details = json.loads(complaint.complaint_details)
    except json.JSONDecodeError:
        details = {"description": complaint.complaint_details}

    if not isinstance(details, dict):
        details = {"description": complaint.complaint_details}

    created = details.get("created")
    if not isinstance(created, int) or created <= 0:
        created = int(datetime.now().timestamp() * 1000)

    status = complaint.status.title()
    resolved = complaint.status.lower() in RESOLVED_STATUSES
    days_remaining = _escalation_days_remaining(complaint, today)
    return {
        "id": f"CMP-AN-{complaint.id:05d}",
        "title": complaint.complaint_type,
        "description": details.get("description", complaint.complaint_details),
        "category": complaint.category,
        "location": details.get("location", "Not provided"),
        "date": details.get("date", date.today().isoformat()),
        "severity": details.get("severity", "Medium"),
        "attachment": details.get("attachment", ""),
        "cell": details.get("cell", "Student Welfare"),
        "officer": "Cell Coordinator",
        "sla": details.get("sla", 72),
        "created": created,
        "status": status,
        "anonymous": complaint.user_name.strip().lower()
        in {"anonymous", "not provided"},
        "complaintDate": complaint.complaint_date.isoformat(),
        "escalationEligible": (
            not resolved
            and complaint.status.lower() != "escalating"
            and days_remaining == 0
        ),
        "daysUntilEscalation": 0 if resolved else days_remaining,
        "escalated": complaint.status.lower() == "escalated",
        "notes": [],
        "timeline": [
            {
                "status": status,
                "comment": (
                    f"Concern submitted anonymously. Routed to "
                    f"{details.get('cell', 'Student Welfare')}."
                ),
                "at": created,
            }
        ]
        + (
            [
                {
                    "status": "Escalated to higher authorities",
                    "comment": complaint.escalation_report
                    or "The complaint was escalated for senior review.",
                    "at": int(
                        datetime.fromisoformat(complaint.escalated_at).timestamp()
                        * 1000
                    )
                    if complaint.escalated_at
                    else created,
                }
            ]
            if complaint.escalated_at
            else []
        ),
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/requests/rewrite-description")
async def rewrite_request_description(
    payload: DescriptionRewriteRequest,
) -> dict[str, str]:
    if not payload.description.strip():
        raise HTTPException(
            status_code=422,
            detail="Enter a description before asking AI to improve it.",
        )

    try:
        from email_tools import rewrite_request_description as rewrite_with_agent

        description = await rewrite_with_agent(payload.description)
    except Exception as error:
        logger.exception("AI request-description rewrite failed")
        raise HTTPException(
            status_code=502,
            detail="The AI could not rewrite this description. Please try again.",
        ) from error

    return {"description": description}


@app.get("/api/complaints")
def list_complaints() -> list[dict[str, object]]:
    with Session(engine) as session:
        complaints = session.scalars(
            select(UserComplaint)
            .where(UserComplaint.user_id == USER_ID)
            .order_by(UserComplaint.id.desc())
        ).all()
    return [_complaint_response(complaint) for complaint in complaints]


@app.delete("/api/complaints/{complaint_id}")
def delete_solved_complaint(complaint_id: str) -> dict[str, object]:
    match = re.fullmatch(r"CMP-AN-(\d{5,})", complaint_id)
    if not match:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    database_id = int(match.group(1))
    with Session(engine) as session:
        complaint = session.scalar(
            select(UserComplaint).where(
                UserComplaint.id == database_id,
                UserComplaint.user_id == USER_ID,
            )
        )
        if complaint is None:
            raise HTTPException(status_code=404, detail="Complaint not found.")
        if complaint.status.lower() == "escalating":
            raise HTTPException(
                status_code=409,
                detail="This complaint cannot be removed while escalation is in progress.",
            )

        session.delete(complaint)
        session.commit()

    logger.info("Student marked complaint %s solved and removed it", complaint_id)
    return {"id": complaint_id, "deleted": True}


@app.post("/api/complaints", status_code=201)
def create_complaint(payload: ComplaintSubmission) -> dict[str, object]:
    complaint_details = json.dumps(
        {
            "description": payload.description,
            "location": payload.location,
            "date": payload.date,
            "severity": payload.severity,
            "attachment": payload.attachment,
            "cell": payload.cell,
            "sla": payload.sla,
            "created": payload.created,
        }
    )
    complaint_payload = UserComplaintCreate(
        user_name="Anonymous",
        complaint_type=payload.title,
        category=payload.category,
        complaint_details=complaint_details,
    )

    with Session(engine) as session:
        complaint = UserComplaint(
            user_id=USER_ID,
            **complaint_payload.model_dump(),
        )
        session.add(complaint)
        session.commit()
        session.refresh(complaint)
        return _complaint_response(complaint)


@app.post("/api/complaints/{complaint_id}/escalate")
async def escalate_complaint(complaint_id: str) -> dict[str, object]:
    match = re.fullmatch(r"CMP-AN-(\d{5,})", complaint_id)
    if not match:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    database_id = int(match.group(1))
    today = date.today()
    with Session(engine) as session:
        complaint = session.scalar(
            select(UserComplaint).where(
                UserComplaint.id == database_id,
                UserComplaint.user_id == USER_ID,
            )
        )
        if complaint is None:
            raise HTTPException(status_code=404, detail="Complaint not found.")
        if complaint.status.lower() in RESOLVED_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="Resolved or already escalated complaints cannot be escalated.",
            )
        if complaint.status.lower() == "escalating":
            raise HTTPException(
                status_code=409,
                detail="This complaint is already being escalated.",
            )
        if _escalation_days_remaining(complaint, today) > 0:
            raise HTTPException(
                status_code=409,
                detail="This complaint can be escalated after three days from submission.",
            )

        original_status = complaint.status
        complaint_data = {
            "complaint_id": complaint_id,
            "complaint_date": complaint.complaint_date.isoformat(),
            "title": complaint.complaint_type,
            "category": complaint.category,
            "status": complaint.status.title(),
            "details": complaint.complaint_details,
        }
        complaint.status = "escalating"
        session.commit()

    try:
        from email_tools import (
            deliver_escalation_report,
            generate_escalation_report,
        )

        report = await generate_escalation_report(complaint_data)
        await deliver_escalation_report(report)
    except Exception as error:
        logger.exception("Complaint escalation delivery failed for %s", complaint_id)
        with Session(engine) as session:
            complaint = session.get(UserComplaint, database_id)
            if complaint and complaint.status == "escalating":
                complaint.status = original_status
                session.commit()
        raise HTTPException(
            status_code=502,
            detail="The escalation report could not be delivered. Please try again.",
        ) from error

    with Session(engine) as session:
        complaint = session.get(UserComplaint, database_id)
        if complaint is None or complaint.status != "escalating":
            raise HTTPException(
                status_code=409,
                detail="The complaint changed while escalation was being processed.",
            )
        complaint.status = "escalated"
        complaint.escalation_report = report
        complaint.escalated_at = datetime.now().isoformat(timespec="seconds")
        session.commit()
        session.refresh(complaint)
        return _complaint_response(complaint, today)


@app.post("/api/complaints/chat")
async def chat(payload: ChatRequest) -> dict[str, str]:
    try:
        from call_back_function import callback

        reply = await callback(
            payload.message,
            [message.model_dump() for message in payload.history],
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail="The complaint assistant could not process this message.",
        ) from error

    if reply.startswith("Error executing pipeline:"):
        raise HTTPException(
            status_code=502,
            detail="The complaint assistant could not process this message.",
        )
    return {"reply": reply}
