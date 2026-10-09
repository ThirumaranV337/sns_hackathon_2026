from pydantic import BaseModel, ConfigDict
from sqlalchemy import JSON, Float, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from data_model_complaint import Base, engine
from student_data import StudentData


DEMO_LEAVE_PROFILES = {
    "S1": {"attendance_percent": 92.0, "cgpa": 8.7},
    "S2": {"attendance_percent": 72.0, "cgpa": 9.3},
    "S3": {"attendance_percent": 68.0, "cgpa": 7.1},
    "S4": {"attendance_percent": 95.0, "cgpa": 8.9},
    "S5": {"attendance_percent": 73.0, "cgpa": 6.8},
    "S6": {"attendance_percent": 96.0, "cgpa": 9.1},
    "S7": {"attendance_percent": 88.0, "cgpa": 8.2},
    "S8": {"attendance_percent": 81.0, "cgpa": 7.6},
    "S9": {"attendance_percent": 94.0, "cgpa": 9.4},
    "S10": {"attendance_percent": 90.0, "cgpa": 8.5},
    "S11": {"attendance_percent": 70.0, "cgpa": 6.9},
    "S12": {"attendance_percent": 93.0, "cgpa": 8.8},
}


class DemoLeaveStudentProfile(Base):
    __tablename__ = "demo_leave_student_profiles"

    student_id: Mapped[str] = mapped_column(String(8), primary_key=True)
    student_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    student_name: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)
    attendance_percent: Mapped[float] = mapped_column(Float, nullable=False)
    cgpa: Mapped[float] = mapped_column(Float, nullable=False)
    subject_scores: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    events_attended: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    achievements: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    extracurricular_activities: Mapped[list[str]] = mapped_column(
        JSON, nullable=False
    )


class DemoLeaveStudentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: str
    student_code: str
    student_name: str
    department: str
    year: int
    attendance_percent: float
    cgpa: float
    subject_scores: dict[str, int]
    events_attended: list[str]
    achievements: list[str]
    extracurricular_activities: list[str]


def seed_demo_leave_profiles() -> int:
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seeded = 0
        for student_id, profile_data in DEMO_LEAVE_PROFILES.items():
            student_code = f"SYN-STU-{int(student_id[1:]):03d}"
            student = session.scalar(
                select(StudentData).where(StudentData.student_code == student_code)
            )
            if student is None:
                continue

            profile = session.get(DemoLeaveStudentProfile, student_id)
            if profile is None:
                profile = DemoLeaveStudentProfile(
                    student_id=student_id,
                    student_code=student_code,
                    student_name=student.student_name,
                    department=student.department,
                    year=student.year,
                    attendance_percent=profile_data["attendance_percent"],
                    cgpa=profile_data["cgpa"],
                    subject_scores=student.subject_scores,
                    events_attended=student.events_attended,
                    achievements=student.achievements,
                    extracurricular_activities=student.extracurricular_activities,
                )
                session.add(profile)
            else:
                profile.student_code = student_code
                profile.student_name = student.student_name
                profile.department = student.department
                profile.year = student.year
                profile.attendance_percent = profile_data["attendance_percent"]
                profile.cgpa = profile_data["cgpa"]
                profile.subject_scores = student.subject_scores
                profile.events_attended = student.events_attended
                profile.achievements = student.achievements
                profile.extracurricular_activities = (
                    student.extracurricular_activities
                )
            seeded += 1
        session.commit()
        return seeded


def get_demo_leave_profile(
    student_id: str,
) -> DemoLeaveStudentProfileRead | None:
    with Session(engine) as session:
        profile = session.get(DemoLeaveStudentProfile, student_id)
        if profile is None:
            return None
        return DemoLeaveStudentProfileRead.model_validate(profile)


Base.metadata.create_all(engine)
