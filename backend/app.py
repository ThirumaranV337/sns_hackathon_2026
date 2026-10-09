import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import AsyncGenerator, Literal

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from data_model_complaint import USER_ID, UserComplaint, UserComplaintCreate, engine
from student_data import StudentData, StudentDataRead
from student_analytics import (
    DEMO_STUDENT_COUNT,
    StudentAnalyticsConfigurationError,
    answer_student_analytics,
    student_analytics_visualizations,
)
from leave_approval_agent import (
    LeaveApprovalConfigurationError,
    review_od_leave_request,
)
from leave_student_profile import get_demo_leave_profile
from project_reviews import (
    MAX_UPLOAD_BYTES,
    ProjectMentorAnalysisRequest,
    ProjectReportSubmission,
    ProjectReportValidationError,
    ProjectReviewConfigurationError,
    analyze_incoming_project_report as run_mentor_project_analysis,
    analyze_project_report,
    create_project_report,
    extract_project_report,
    get_project_reports,
    project_report_payload,
    submit_project_report,
)
from marketplace_agent import (
    MarketplaceAssistantConfigurationError,
    answer_marketplace_question,
)
from marketplace_products import (
    MarketplaceChatRequest,
    find_marketplace_products,
    list_marketplace_products,
    marketplace_product_payload,
    seed_marketplace_products,
)

load_dotenv(Path(__file__).resolve().with_name(".env"))


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


class StudyChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=5000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class StudentAnalyticsMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class StudentAnalyticsRequest(BaseModel):
    question: str = Field(min_length=1, max_length=3000)
    history: list[StudentAnalyticsMessage] = Field(
        default_factory=list, max_length=8
    )
    role: Literal["Student", "Faculty", "Admin"]
    student_id: str | None = Field(default=None, max_length=20)


class LeaveApprovalAIRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)
    student_id: str = Field(pattern=r"^S(?:[1-9]|1[0-2])$")
    faculty_id: str = Field(pattern=r"^(?:F[1-3]|A1)$")
    title: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=80)
    from_date: date
    to_date: date
    description: str = Field(min_length=1, max_length=5000)
    supporting_document: str = Field(default="", max_length=255)


ESCALATION_WAIT_DAYS = 3
RESOLVED_STATUSES = {"resolved", "closed", "escalated"}
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    if not list_marketplace_products():
        seed_marketplace_products()
    yield


app = FastAPI(title="CampusFlow API", version="1.0.0", lifespan=lifespan)

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


@app.get("/api/marketplace/products")
def get_marketplace_products() -> list[dict[str, object]]:
    products = list_marketplace_products()
    if not products:
        logger.error("Marketplace catalog is empty; seeding synthetic products.")
        seed_marketplace_products()
        products = list_marketplace_products()
    return [marketplace_product_payload(product) for product in products]


@app.post("/api/marketplace/chat")
async def marketplace_chat(
    payload: MarketplaceChatRequest,
) -> dict[str, object]:
    message = payload.message.strip()
    if not message:
        raise HTTPException(
            status_code=422,
            detail="Enter a question about items in the campus marketplace.",
        )

    try:
        matches = find_marketplace_products(message)
        return await answer_marketplace_question(
            message,
            [item.model_dump() for item in payload.history],
            matches,
        )
    except MarketplaceAssistantConfigurationError as error:
        logger.error("Marketplace assistant is not configured: %s", error)
        raise HTTPException(
            status_code=503,
            detail="The marketplace assistant is not configured. Set SARAVAM_API in the backend environment.",
        ) from error
    except Exception as error:
        logger.exception("Sarvam marketplace assistant request failed")
        raise HTTPException(
            status_code=502,
            detail="The marketplace assistant could not answer. Please try again.",
        ) from error


@app.get("/api/students", response_model=list[StudentDataRead])
def list_students() -> list[StudentData]:
    with Session(engine) as session:
        return session.scalars(
            select(StudentData).order_by(StudentData.student_code)
        ).all()


@app.post("/api/students/analytics")
async def student_analytics_chat(
    payload: StudentAnalyticsRequest,
) -> dict[str, object]:
    if not payload.question.strip():
        raise HTTPException(
            status_code=422,
            detail="Enter a question about student analytics.",
        )

    with Session(engine) as session:
        query = select(StudentData)
        if payload.role == "Student":
            match = re.fullmatch(r"S([1-9]\d*)", payload.student_id or "")
            if not match or int(match.group(1)) > DEMO_STUDENT_COUNT:
                raise HTTPException(
                    status_code=403,
                    detail="A valid demo student profile is required.",
                )
            student_code = f"SYN-STU-{int(match.group(1)):03d}"
            query = query.where(StudentData.student_code == student_code)
            scope = "the current demo student's own record"
        else:
            scope = "all synthetic student records for faculty and management"

        records = [
            StudentDataRead.model_validate(student).model_dump()
            for student in session.scalars(query.order_by(StudentData.student_code))
        ]

    if not records:
        raise HTTPException(
            status_code=503,
            detail="Student data is not seeded. Run `uv run python seed_student_data.py` in the backend directory.",
        )

    try:
        answer, interpretation_available = await answer_student_analytics(
            payload.question.strip(),
            [message.model_dump() for message in payload.history],
            records,
            scope,
        )
    except StudentAnalyticsConfigurationError as error:
        logger.error("Student analytics agent is not configured: %s", error)
        raise HTTPException(
            status_code=503,
            detail="Student analytics is not configured. Set SARAVAM_API in the backend environment.",
        ) from error
    except Exception as error:
        logger.exception("Student analytics request failed")
        raise HTTPException(
            status_code=502,
            detail="Student analytics could not generate an answer. Please try again.",
        ) from error

    return {
        "answer": answer,
        "recordsAnalyzed": len(records),
        "interpretationAvailable": interpretation_available,
        "visualizations": student_analytics_visualizations(
            payload.question.strip(), records
        ),
    }


@app.post("/api/projects/reports/analyze")
async def upload_and_analyze_project_report(
    project_id: str = Form(min_length=1, max_length=80),
    project_name: str = Form(min_length=1, max_length=200),
    student_id: str = Form(min_length=1, max_length=40),
    mentor_id: str = Form(default="", max_length=40),
    file: UploadFile = File(...),
) -> dict[str, object]:
    filename = file.filename or ""
    try:
        file_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()

    try:
        safe_filename, extracted_text, text_was_truncated = extract_project_report(
            filename,
            file_bytes,
        )
    except ProjectReportValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        analysis = await analyze_project_report(
            project_name,
            extracted_text,
            text_was_truncated,
        )
    except ProjectReviewConfigurationError as error:
        logger.error("Project report review agent is not configured: %s", error)
        raise HTTPException(
            status_code=503,
            detail="Project report review is not configured. Set SARAVAM_API in the backend environment.",
        ) from error
    except Exception as error:
        logger.exception("AI project report analysis failed")
        raise HTTPException(
            status_code=502,
            detail="The project report could not be analyzed. Please try again.",
        ) from error

    report = create_project_report(
        project_id=project_id.strip(),
        project_name=project_name.strip(),
        student_id=student_id.strip(),
        mentor_id=mentor_id.strip() or None,
        filename=safe_filename,
        extracted_text=extracted_text,
        text_was_truncated=text_was_truncated,
        analysis=analysis,
    )
    return project_report_payload(report)


@app.get("/api/projects/reports")
def list_project_reports(
    project_id: str = Query(min_length=1, max_length=80),
    role: Literal["Student", "Faculty"] = Query(...),
    user_id: str = Query(min_length=1, max_length=40),
) -> list[dict[str, object]]:
    reports = get_project_reports(project_id.strip(), role, user_id.strip())
    return [project_report_payload(report) for report in reports]


@app.post("/api/projects/reports/{report_id}/submit")
def submit_report_to_mentor(
    report_id: int,
    payload: ProjectReportSubmission,
) -> dict[str, object]:
    if not payload.mentor_id.strip():
        raise HTTPException(
            status_code=422,
            detail="Choose a faculty mentor before submitting this report.",
        )
    try:
        report = submit_project_report(
            report_id,
            payload.student_id.strip(),
            payload.mentor_id.strip(),
        )
    except ProjectReportValidationError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if report is None:
        raise HTTPException(status_code=404, detail="Project report not found.")
    return project_report_payload(report)


@app.post("/api/projects/reports/{report_id}/mentor-analysis")
async def analyze_incoming_project_report(
    report_id: int,
    payload: ProjectMentorAnalysisRequest,
) -> dict[str, object]:
    try:
        report = await run_mentor_project_analysis(
            report_id,
            payload.mentor_id.strip(),
        )
    except ProjectReviewConfigurationError as error:
        logger.error("Project report review agent is not configured: %s", error)
        raise HTTPException(
            status_code=503,
            detail="Project report review is not configured. Set SARAVAM_API in the backend environment.",
        ) from error
    except Exception as error:
        logger.exception("Mentor AI project report review failed")
        raise HTTPException(
            status_code=502,
            detail="The incoming project report could not be analyzed. Please try again.",
        ) from error
    if report is None:
        raise HTTPException(
            status_code=404,
            detail="Submitted project report not found for this mentor.",
        )
    return project_report_payload(report)


@app.post("/api/study-assistant/chat")
async def study_assistant_chat(payload: StudyChatRequest) -> dict[str, str]:
    if not payload.question.strip():
        raise HTTPException(
            status_code=422,
            detail="Enter a question for the study assistant.",
        )

    try:
        from study_assistant import (
            StudyAssistantConfigurationError,
            answer_study_question,
        )

        answer = await answer_study_question(
            payload.question.strip(),
            [message.model_dump() for message in payload.history],
        )
    except StudyAssistantConfigurationError as error:
        logger.error("Study assistant is not configured: %s", error)
        raise HTTPException(
            status_code=503,
            detail="The study assistant is not configured. Set SARAVAM_API in the backend environment.",
        ) from error
    except Exception as error:
        logger.exception("Sarvam study assistant request failed")
        raise HTTPException(
            status_code=502,
            detail="The study assistant could not generate an answer. Please try again.",
        ) from error

    return {"answer": answer}


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


@app.post("/api/requests/ai-review")
async def ai_review_od_leave_request(
    payload: LeaveApprovalAIRequest,
) -> dict[str, object]:
    if payload.to_date < payload.from_date:
        raise HTTPException(
            status_code=422,
            detail="The request end date must be on or after its start date.",
        )

    profile = get_demo_leave_profile(payload.student_id)
    if profile is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Demo student performance data is not seeded. Run "
                "`uv run python seed_leave_profiles.py` in the backend directory."
            ),
        )

    request_context = {
        "request_id": payload.request_id,
        "student_id": payload.student_id,
        "request_title": payload.title,
        "request_category": payload.category,
        "from_date": payload.from_date.isoformat(),
        "to_date": payload.to_date.isoformat(),
        "duration_days_inclusive": (payload.to_date - payload.from_date).days + 1,
        "description": payload.description.strip(),
        "supporting_document_filename": payload.supporting_document.strip() or None,
        "faculty_reviewer_id": payload.faculty_id,
    }
    try:
        return await review_od_leave_request(request_context, profile)
    except LeaveApprovalConfigurationError as error:
        logger.error("OD/leave review agent is not configured: %s", error)
        raise HTTPException(
            status_code=503,
            detail="The AI reviewer is not configured. Set SARAVAM_API in the backend environment.",
        ) from error
    except Exception as error:
        logger.exception("AI OD/leave request review failed for %s", payload.request_id)
        raise HTTPException(
            status_code=502,
            detail="The AI could not review this request. Please try again.",
        ) from error


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
