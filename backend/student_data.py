from pydantic import BaseModel, ConfigDict
from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from data_model_complaint import Base, engine


class StudentData(Base):
    __tablename__ = "student_data"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    student_name: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    year: Mapped[int] = mapped_column(nullable=False)
    semester: Mapped[int] = mapped_column(nullable=False)
    subject_scores: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    events_attended: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    achievements: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    extracurricular_activities: Mapped[list[str]] = mapped_column(JSON, nullable=False)


class StudentDataRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_code: str
    student_name: str
    department: str
    year: int
    semester: int
    subject_scores: dict[str, int]
    events_attended: list[str]
    achievements: list[str]
    extracurricular_activities: list[str]


Base.metadata.create_all(engine)
