from pathlib import Path
from datetime import date

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Date, String, Text, create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.engine import URL


USER_ID = 1
DATABASE_PATH = Path(__file__).resolve().parent / "complaints.db"
DATABASE_URL = URL.create("sqlite", database=str(DATABASE_PATH))
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    pass


class UserComplaint(Base):
    __tablename__ = "user_complaints"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(nullable=False, default=USER_ID, index=True)
    user_name: Mapped[str] = mapped_column(String(200), nullable=False)
    complaint_type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    complaint_details: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="submitted")
    complaint_date: Mapped[date] = mapped_column(
        Date, nullable=False, default=date.today
    )
    escalation_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalated_at: Mapped[str | None] = mapped_column(String(32), nullable=True)


class UserComplaintCreate(BaseModel):
    user_name: str = Field(min_length=1, max_length=200)
    complaint_type: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)
    complaint_details: str = Field(min_length=1)
    status: Literal["submitted"] = "submitted"


class UserComplaintRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_name: str
    complaint_type: str
    category: str
    complaint_details: str
    status: str


Base.metadata.create_all(engine)

existing_columns = {
    column["name"] for column in inspect(engine).get_columns("user_complaints")
}
with engine.begin() as connection:
    if "user_id" not in existing_columns:
        connection.exec_driver_sql(
            "ALTER TABLE user_complaints "
            "ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1"
        )
    if "complaint_details" not in existing_columns:
        connection.exec_driver_sql(
            "ALTER TABLE user_complaints "
            "ADD COLUMN complaint_details TEXT NOT NULL DEFAULT ''"
        )
    if "complaint_date" not in existing_columns:
        connection.exec_driver_sql(
            "ALTER TABLE user_complaints ADD COLUMN complaint_date DATE"
        )
    if "escalation_report" not in existing_columns:
        connection.exec_driver_sql(
            "ALTER TABLE user_complaints ADD COLUMN escalation_report TEXT"
        )
    if "escalated_at" not in existing_columns:
        connection.exec_driver_sql(
            "ALTER TABLE user_complaints ADD COLUMN escalated_at VARCHAR(32)"
        )
    connection.exec_driver_sql(
        "UPDATE user_complaints SET complaint_date = ? "
        "WHERE complaint_date IS NULL",
        (date.today().isoformat(),),
    )
    connection.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_user_complaints_user_id "
        "ON user_complaints (user_id)"
    )
