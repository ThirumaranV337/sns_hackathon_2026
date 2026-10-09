import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from data_model_complaint import engine
from student_data import StudentData


FIRST_NAMES = [
    "Aarav", "Aditi", "Akash", "Ananya", "Arjun",
    "Diya", "Ishaan", "Kavya", "Meera", "Rohan",
]
LAST_NAMES = [
    "Sharma", "Patel", "Reddy", "Nair", "Gupta",
    "Iyer", "Kumar", "Das", "Rao", "Menon",
]
DEPARTMENT_SUBJECTS = {
    "Computer Science": [
        "Programming", "Data Structures", "Database Systems", "Operating Systems",
        "Computer Networks", "Software Engineering", "Web Development",
        "Artificial Intelligence", "Computer Architecture", "Mathematics",
    ],
    "Electronics": [
        "Circuit Theory", "Digital Electronics", "Signals and Systems",
        "Microprocessors", "Communication Systems", "Embedded Systems",
        "Electromagnetics", "Control Systems", "VLSI Design", "Mathematics",
    ],
    "Electrical": [
        "Circuit Analysis", "Electrical Machines", "Power Systems",
        "Power Electronics", "Control Systems", "Electrical Measurements",
        "Renewable Energy", "Signals and Systems", "Electrical Design",
        "Mathematics",
    ],
    "Mechanical": [
        "Engineering Mechanics", "Thermodynamics", "Fluid Mechanics",
        "Manufacturing Processes", "Machine Design", "Heat Transfer",
        "Materials Science", "CAD and Drafting", "Production Systems",
        "Mathematics",
    ],
    "Civil": [
        "Structural Analysis", "Surveying", "Geotechnical Engineering",
        "Fluid Mechanics", "Transportation Engineering", "Concrete Technology",
        "Environmental Engineering", "Construction Management",
        "Building Materials", "Mathematics",
    ],
    "Business": [
        "Accounting", "Business Economics", "Marketing", "Human Resources",
        "Financial Management", "Business Analytics", "Operations Management",
        "Business Law", "Entrepreneurship", "Organizational Behaviour",
    ],
}
DEPARTMENTS = tuple(DEPARTMENT_SUBJECTS)
EVENTS = [
    "Annual cultural festival", "Technical symposium", "Sports meet",
    "Career development workshop", "Department seminar", "Community outreach",
    "Innovation showcase", "Wellness and fitness day",
]
ACHIEVEMENTS = [
    "Academic merit recognition", "Inter-college competition finalist",
    "Project showcase award", "Community service recognition",
    "Department distinction",
]
ACTIVITIES = [
    "Coding club", "Debate society", "Music club", "Student volunteering",
    "Robotics club", "Sports team", "Photography club", "Entrepreneurship cell",
]
DEMO_STUDENT_PROFILES = [
    ("Aarav Sharma", "Computer Science"),
    ("Diya Nair", "Electronics"),
    ("Arjun Kumar", "Mechanical"),
    ("Meera Krishnan", "Computer Science"),
    ("Rohan Patel", "Electronics"),
    ("Ananya Rao", "Mechanical"),
    ("Kavin Raj", "Computer Science"),
    ("Ishita Singh", "Electronics"),
    ("Aditya Menon", "Mechanical"),
    ("Sneha Reddy", "Computer Science"),
    ("Pranav S", "Electronics"),
    ("Nila Arun", "Mechanical"),
]


def _synthetic_student(index: int) -> StudentData:
    rng = random.Random(20261009 + index)
    if index < len(DEMO_STUDENT_PROFILES):
        student_name, department = DEMO_STUDENT_PROFILES[index]
        year = 3
    else:
        department = DEPARTMENTS[index % len(DEPARTMENTS)]
        first_name = FIRST_NAMES[index // len(LAST_NAMES)]
        last_name = LAST_NAMES[index % len(LAST_NAMES)]
        student_name = f"{first_name} {last_name}"
        year = (index % 4) + 1
    semester = (year - 1) * 2 + rng.choice((1, 2))

    return StudentData(
        student_code=f"SYN-STU-{index + 1:03d}",
        student_name=student_name,
        department=department,
        year=year,
        semester=semester,
        subject_scores={
            subject: rng.randint(55, 100)
            for subject in DEPARTMENT_SUBJECTS[department]
        },
        events_attended=sorted(rng.sample(EVENTS, k=rng.randint(1, 6))),
        achievements=sorted(
            rng.sample(ACHIEVEMENTS, k=rng.randint(0, 3))
        ),
        extracurricular_activities=sorted(
            rng.sample(ACTIVITIES, k=rng.randint(1, 4))
        ),
    )


def seed_students() -> int:
    with Session(engine) as session:
        existing_students = {
            student.student_code: student
            for student in session.scalars(select(StudentData)).all()
        }
        inserted = 0
        for index in range(100):
            generated = _synthetic_student(index)
            existing = existing_students.get(generated.student_code)
            if existing is None:
                session.add(generated)
                inserted += 1
                continue
            for field in (
                "student_name",
                "department",
                "year",
                "semester",
                "subject_scores",
                "events_attended",
                "achievements",
                "extracurricular_activities",
            ):
                setattr(existing, field, getattr(generated, field))
        session.commit()
        return inserted


if __name__ == "__main__":
    inserted = seed_students()
    print(f"Added {inserted} synthetic student records.")
