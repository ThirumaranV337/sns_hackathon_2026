from leave_student_profile import seed_demo_leave_profiles


if __name__ == "__main__":
    count = seed_demo_leave_profiles()
    if count != 12:
        raise SystemExit(
            f"Expected 12 seeded demo student profiles, but found {count}. "
            "Run `uv run python seed_student_data.py` first."
        )
    print(f"Seeded {count} synthetic OD/leave review student profiles.")
