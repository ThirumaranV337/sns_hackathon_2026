import json
import logging
import os
import re
from collections import Counter, defaultdict
from functools import lru_cache
from statistics import fmean

from agents import Agent, ModelSettings, OpenAIChatCompletionsModel, Runner
from agents.exceptions import ModelBehaviorError
from openai import AsyncOpenAI


logger = logging.getLogger(__name__)
SARVAM_BASE_URL = "https://api.sarvam.ai/v1"
SARVAM_MODEL = "sarvam-105b"
DEMO_STUDENT_COUNT = 12


class StudentAnalyticsConfigurationError(RuntimeError):
    pass


def _analytics_context(
    question: str,
    records: list[dict[str, object]],
    scope: str,
) -> dict[str, object]:
    department_scores: dict[str, list[int]] = defaultdict(list)
    department_subject_scores: dict[str, dict[str, list[int]]] = defaultdict(
        lambda: defaultdict(list)
    )
    event_counts: Counter[str] = Counter()
    achievement_counts: Counter[str] = Counter()
    activity_counts: Counter[str] = Counter()
    overall_subject_scores: dict[str, list[int]] = defaultdict(list)

    for record in records:
        department = str(record["department"])
        scores = record["subject_scores"]
        if not isinstance(scores, dict):
            continue
        numeric_scores = [int(score) for score in scores.values()]
        department_scores[department].extend(numeric_scores)
        for subject, score in scores.items():
            department_subject_scores[department][str(subject)].append(int(score))
            overall_subject_scores[str(subject)].append(int(score))

        events = record["events_attended"]
        achievements = record["achievements"]
        activities = record["extracurricular_activities"]
        event_counts.update(events if isinstance(events, list) else [])
        achievement_counts.update(
            achievements if isinstance(achievements, list) else []
        )
        activity_counts.update(activities if isinstance(activities, list) else [])
    department_summary = {
        department: {
            "students": sum(
                1 for record in records if record["department"] == department
            ),
            "average_across_recorded_subject_scores": round(fmean(scores), 2),
            "score_count": len(scores),
        }
        for department, scores in department_scores.items()
        if scores
    }
    student_rankings = []
    for record in records:
        scores = record["subject_scores"]
        if not isinstance(scores, dict) or not scores:
            continue
        numeric_scores = [int(score) for score in scores.values()]
        student_rankings.append(
            {
                "student_code": record["student_code"],
                "name": record["student_name"],
                "department": record["department"],
                "year": record["year"],
                "average_subject_score": round(fmean(numeric_scores), 2),
            }
        )
    student_rankings.sort(
        key=lambda item: (
            -float(item["average_subject_score"]),
            str(item["student_code"]),
        )
    )

    department_rankings = []
    for department in department_summary:
        best_student = next(
            (
                student
                for student in student_rankings
                if student["department"] == department
            ),
            None,
        )
        department_rankings.append(
            {
                "department": department,
                "average_score": department_summary[department][
                    "average_across_recorded_subject_scores"
                ],
                "best_student": best_student,
            }
        )
    subject_summary = {
        department: {
            subject: {
                "count": len(scores),
                "average": round(fmean(scores), 2),
                "minimum": min(scores),
                "maximum": max(scores),
            }
            for subject, scores in subjects.items()
        }
        for department, subjects in department_subject_scores.items()
    }
    overall_subject_summary = [
        {
            "subject": subject,
            "recorded_scores": len(scores),
            "average_score": round(fmean(scores), 2),
            "minimum_score": min(scores),
            "maximum_score": max(scores),
        }
        for subject, scores in overall_subject_scores.items()
    ]
    overall_subject_summary.sort(
        key=lambda item: (
            float(item["average_score"]),
            -int(item["recorded_scores"]),
            str(item["subject"]),
        )
    )

    normalized_question = question.casefold()
    matching_details = []
    if len(records) <= DEMO_STUDENT_COUNT:
        matching_details = records
    else:
        for record in records:
            searchable = [
                str(record["student_code"]),
                str(record["student_name"]),
                str(record["department"]),
                *(
                    str(value)
                    for key in (
                        "subject_scores",
                        "events_attended",
                        "achievements",
                        "extracurricular_activities",
                    )
                    for value in (
                        record[key].keys()
                        if key == "subject_scores"
                        and isinstance(record[key], dict)
                        else record[key]
                        if isinstance(record[key], list)
                        else []
                    )
                ),
            ]
            if any(value.casefold() in normalized_question for value in searchable):
                matching_details.append(record)

    normalized_question = question.casefold()
    include_subjects = any(
        term in normalized_question
        for term in ("subject", "score", "mark", "grade", "lowest", "highest", "weak")
    ) and "by department" not in normalized_question
    include_departments = any(
        term in normalized_question for term in ("department", "dept", "compare")
    )
    include_students = len(records) == 1 or any(
        term in normalized_question
        for term in (
            "top student",
            "lowest student",
            "weakest student",
            "best student",
            "highest scoring student",
            "student ranking",
            "student performance",
            "student average",
            "students by score",
            "performer",
            "rank",
            "who scored",
        )
    )
    include_events = "event" in normalized_question
    include_achievements = any(
        term in normalized_question
        for term in ("achievement", "award", "recognition")
    )
    include_activities = any(
        term in normalized_question
        for term in ("activity", "activities", "club", "extracurricular")
    )
    context: dict[str, object] = {
        "scope": scope,
        "data_is_synthetic": True,
        "record_count": len(records),
    }
    if include_subjects:
        context["subject_averages_lowest_first"] = overall_subject_summary[:8]
        context["subject_averages_highest_first"] = overall_subject_summary[-5:][::-1]
    if include_departments:
        context["average_subject_scores_by_department"] = department_summary
        context["top_student_by_department"] = department_rankings
        if any(
            phrase in normalized_question
            for phrase in (
                "each subject by department",
                "subject-level by department",
                "subject by department",
            )
        ):
            context["department_and_subject_averages"] = subject_summary
    if include_students:
        context["top_students_by_average_subject_score"] = student_rankings[:10]
        context["bottom_students_by_average_subject_score"] = student_rankings[-10:][::-1]
        context["ranking_definition"] = (
            "Mean of each student's recorded subject scores, higher is better."
        )
    if include_events:
        context["event_attendance_counts"] = dict(event_counts.most_common())
    if include_achievements:
        context["achievement_counts"] = dict(achievement_counts.most_common())
    if include_activities:
        context["extracurricular_activity_counts"] = dict(
            activity_counts.most_common()
        )
    if not any(
        (
            include_subjects,
            include_departments,
            include_students,
            include_events,
            include_achievements,
            include_activities,
        )
    ):
        context["average_subject_scores_by_department"] = department_summary
        context["top_students_by_average_subject_score"] = student_rankings[:5]
        context["subject_averages_lowest_first"] = overall_subject_summary[:5]
        context["event_attendance_counts"] = dict(event_counts.most_common(5))
    if matching_details:
        context["matching_full_records"] = matching_details
    return context


def _verified_findings(question: str, context: dict[str, object]) -> str:
    lines = [
        "## Verified database findings",
        f"- Records analyzed: {context['record_count']} synthetic student record(s).",
    ]
    question_lower = question.casefold()
    plain_language_notes = []
    asks_about_subjects = any(
        term in question_lower
        for term in ("subject", "score", "mark", "grade", "lowest", "highest", "weak")
    )
    asks_about_departments = any(
        term in question_lower for term in ("department", "dept", "compare")
    )
    asks_about_student_rankings = any(
        term in question_lower
        for term in (
            "performer",
            "best",
            "top student",
            "lowest student",
            "student ranking",
            "rank",
            "who scored",
        )
    )

    if asks_about_subjects and context.get("subject_averages_lowest_first"):
        plain_language_notes.append(
            "A subject average is the total of its recorded scores divided by "
            "the number of scores. It shows a general pattern, not a pass rate "
            "or how difficult the subject is."
        )
    if asks_about_departments and context.get("average_subject_scores_by_department"):
        plain_language_notes.append(
            "A department average combines the subject scores recorded for its "
            "students. It describes this dataset; it does not measure teaching "
            "quality or explain why scores differ."
        )
    if (
        asks_about_student_rankings
        and context.get("top_students_by_average_subject_score")
    ):
        plain_language_notes.append(
            "A student average is based only on recorded subject scores. It is "
            "one view of performance, not a complete picture of a person's "
            "effort, progress, or circumstances."
        )
    if any(
        key in context
        for key in (
            "event_attendance_counts",
            "achievement_counts",
            "extracurricular_activity_counts",
        )
    ):
        plain_language_notes.append(
            "Activity and event totals count entries in the records; they do "
            "not measure the quality of someone's participation."
        )
    if plain_language_notes:
        lines.extend(["", "## In plain language"])
        lines.extend(f"- {note}" for note in plain_language_notes)

    subjects = context.get("subject_averages_lowest_first")
    if isinstance(subjects, list) and subjects:
        count = 5 if "lowest" in question_lower else 3
        if "highest" in question_lower or "strongest" in question_lower:
            selected_subjects = list(reversed(subjects[-count:]))
            label = "Highest average subject scores"
        else:
            selected_subjects = subjects[:count]
            label = "Lowest average subject scores"
        lines.append(f"- {label} (mean score; n = recorded assessments):")
        for subject in selected_subjects:
            lines.append(
                "  - {subject}: {average:.2f} ({count} assessments; range "
                "{minimum}-{maximum}).".format(
                    subject=subject["subject"],
                    average=subject["average_score"],
                    count=subject["recorded_scores"],
                    minimum=subject["minimum_score"],
                    maximum=subject["maximum_score"],
                )
            )

    departments = context.get("average_subject_scores_by_department")
    if isinstance(departments, dict) and departments:
        ranked_departments = sorted(
            departments.items(),
            key=lambda item: item[1]["average_across_recorded_subject_scores"],
            reverse=True,
        )
        lines.append("- Department mean subject scores (highest first):")
        for name, stats in ranked_departments:
            lines.append(
                "  - {department}: {average:.2f} across {students} students "
                "and {scores} recorded assessments.".format(
                    department=name,
                    average=stats["average_across_recorded_subject_scores"],
                    students=stats["students"],
                    scores=stats["score_count"],
                )
            )

    if "top_students_by_average_subject_score" in context:
        rankings = context["top_students_by_average_subject_score"]
        ranking_phrase = (
            "lowest"
            if any(
                word in question.casefold()
                for word in ("lowest", "bottom", "weakest", "at risk")
            )
            else "highest"
        )
        if ranking_phrase == "lowest":
            rankings = context.get("bottom_students_by_average_subject_score", [])
        elif "best" in question.casefold() and isinstance(rankings, list):
            rankings = rankings[:1]
        if isinstance(rankings, list) and rankings:
            lines.append(
                f"- Students with {ranking_phrase} mean subject scores "
                "(highest/lowest based only on recorded assessments):"
            )
            for student in rankings[:5]:
                lines.append(
                    "  - {name} ({code}, {department}, year {year}): "
                    "{average:.2f}.".format(
                        name=student["name"],
                        code=student["student_code"],
                        department=student["department"],
                        year=student["year"],
                        average=student["average_subject_score"],
                    )
                )

    for key, label in (
        ("event_attendance_counts", "Events attended"),
        ("achievement_counts", "Achievements"),
        ("extracurricular_activity_counts", "Extracurricular activities"),
    ):
        counts = context.get(key)
        if isinstance(counts, dict) and counts:
            lines.append(
                f"- {label} (record count): "
                + ", ".join(f"{name}: {count}" for name, count in counts.items())
                + "."
            )

    matching_records = context.get("matching_full_records")
    if isinstance(matching_records, list):
        for record in matching_records:
            scores = record.get("subject_scores")
            if not isinstance(scores, dict):
                continue
            lines.append(
                f"- {record['student_name']} ({record['student_code']}) subject scores: "
                + ", ".join(f"{subject}: {score}" for subject, score in scores.items())
                + "."
            )

    lines.append(
        "- Data note: these are synthetic records; score values use the demo "
        "dataset's 0-100 scale."
    )
    if "attendance" in question.casefold():
        lines.append(
            "- Attendance cannot be analyzed because no attendance field exists "
            "in the student database."
        )
    return "\n".join(lines)


def student_analytics_visualizations(
    question: str,
    records: list[dict[str, object]],
) -> list[dict[str, object]]:
    context = _analytics_context(question, records, "visualization")
    question_lower = question.casefold()
    subject_query = any(
        term in question_lower
        for term in ("subject", "score", "mark", "grade", "lowest", "highest", "weak")
    )
    activity_query = any(
        term in question_lower
        for term in ("event", "achievement", "award", "activity", "club", "extracurricular")
    )
    charts: list[dict[str, object]] = []

    def add_chart(
        title: str,
        description: str,
        data: list[dict[str, object]],
        unit: str,
    ) -> None:
        if data:
            charts.append(
                {
                    "title": title,
                    "description": description,
                    "unit": unit,
                    "data": data,
                }
            )

    if len(records) == 1 and (
        subject_query or not activity_query
    ):
        personal_records = context.get("matching_full_records")
        if isinstance(personal_records, list) and personal_records:
            scores = personal_records[0].get("subject_scores")
            if isinstance(scores, dict):
                add_chart(
                    "Your scores by subject",
                    "Each bar shows one recorded subject score on the 0-100 scale.",
                    [
                        {"label": str(subject), "value": int(score)}
                        for subject, score in scores.items()
                    ],
                    "score out of 100",
                )

    if len(records) > 1 and subject_query:
        subjects = context.get("subject_averages_lowest_first")
        if isinstance(subjects, list):
            if "highest" in question_lower or "strongest" in question_lower:
                selected = list(reversed(subjects[-6:]))
                title = "Highest average scores by subject"
            else:
                selected = subjects[:6]
                title = "Lowest average scores by subject"
            add_chart(
                title,
                "Each bar is the mean of the recorded scores for that subject.",
                [
                    {"label": str(subject["subject"]), "value": float(subject["average_score"])}
                    for subject in selected
                ],
                "average score out of 100",
            )

    if any(term in question_lower for term in ("department", "dept", "compare")):
        departments = context.get("average_subject_scores_by_department")
        if isinstance(departments, dict):
            ranked = sorted(
                departments.items(),
                key=lambda item: float(
                    item[1]["average_across_recorded_subject_scores"]
                ),
            )
            add_chart(
                "Average scores by department",
                "Each bar combines recorded subject scores for students in that department.",
                [
                    {
                        "label": str(name),
                        "value": float(stats["average_across_recorded_subject_scores"]),
                    }
                    for name, stats in ranked
                ],
                "average score out of 100",
            )

    if any(
        term in question_lower
        for term in (
            "performer",
            "best",
            "top student",
            "lowest student",
            "student ranking",
            "rank",
            "who scored",
        )
    ):
        rankings = context.get("top_students_by_average_subject_score")
        if isinstance(rankings, list):
            if any(
                term in question_lower
                for term in ("lowest", "bottom", "weakest", "at risk")
            ):
                rankings = context.get("bottom_students_by_average_subject_score", [])
                title = "Students with the lowest subject averages"
            else:
                title = "Students with the highest subject averages"
            if isinstance(rankings, list):
                add_chart(
                    title,
                    "Each bar is that student's mean across their recorded subject scores.",
                    [
                        {
                            "label": str(student["name"]),
                            "value": float(student["average_subject_score"]),
                        }
                        for student in rankings[:6]
                    ],
                    "average score out of 100",
                )

    for key, title, description in (
        (
            "event_attendance_counts",
            "Recorded event entries",
            "Counts how often each event appears in the analyzed records.",
        ),
        (
            "achievement_counts",
            "Recorded achievements",
            "Counts how often each achievement appears in the analyzed records.",
        ),
        (
            "extracurricular_activity_counts",
            "Recorded extracurricular activities",
            "Counts how often each activity appears in the analyzed records.",
        ),
    ):
        if key.removesuffix("_counts").split("_")[0] in question_lower or (
            key == "extracurricular_activity_counts"
            and any(term in question_lower for term in ("activity", "club", "extracurricular"))
        ):
            counts = context.get(key)
            if isinstance(counts, dict):
                add_chart(
                    title,
                    description,
                    [
                        {"label": str(label), "value": int(value)}
                        for label, value in sorted(
                            counts.items(), key=lambda item: int(item[1]), reverse=True
                        )[:8]
                    ],
                    "recorded entries",
                )

    return charts


@lru_cache(maxsize=1)
def _create_student_analytics_agent() -> Agent:
    api_key = os.getenv("SARAVAM_API")
    if not api_key:
        raise StudentAnalyticsConfigurationError(
            "Set SARAVAM_API in the backend environment to enable student analytics."
        )

    client = AsyncOpenAI(base_url=SARVAM_BASE_URL, api_key=api_key)
    model = OpenAIChatCompletionsModel(
        model=SARVAM_MODEL,
        openai_client=client,
    )
    return Agent(
        name="CampusFlow Educational Data Analyst",
        instructions=(
            "You are a specialist educational data analyst supporting "
            "students, faculty, and campus management. Use clear, everyday "
            "language suitable for a non-specialist. Briefly explain an "
            "unfamiliar analytics concept when it helps the reader. The backend supplies "
            "verified statistical findings separately. Your task is to give "
            "a brief educational interpretation and a practical next step "
            "based only on the supplied evidence. Do not repeat names, "
            "numbers, rankings, or measurements because the verified findings "
            "are shown alongside your interpretation. Do not infer causes, "
            "predict outcomes, or claim attendance data that is not supplied. "
            "For management, offer proportionate options as decision support, "
            "never automated high-stakes decisions. Mention relevant "
            "limitations, including that records are synthetic and small "
            "groups may not support firm conclusions. Do not contradict, "
            "dismiss, or undermine the verified answer. Do not make your own "
            "comparative claims about which student, subject, or department "
            "ranks highest or lowest; refer to the verified findings for "
            "those facts. For student rankings, explain that a subject-score "
            "average is only one measure of performance; do not advise against "
            "answering the descriptive question. Answer in at most 60 words. "
            "Use history only to resolve a follow-up reference."
        ),
        model=model,
        model_settings=ModelSettings(
            max_tokens=6000,
            extra_body={"reasoning_effort": "low"},
        ),
    )


async def answer_student_analytics(
    question: str,
    history: list[dict[str, str]],
    records: list[dict[str, object]],
    scope: str,
) -> tuple[str, bool]:
    follow_up_markers = (
        "it",
        "that",
        "those",
        "these",
        "them",
        "above",
        "previous",
        "earlier",
        "same",
        "more",
        "less",
        "why",
        "how about",
        "what about",
        "compare that",
        "explain",
    )
    is_follow_up = any(
        re.search(rf"\b{re.escape(marker)}\b", question.casefold())
        for marker in follow_up_markers
    )
    conversation = [
        {"role": message["role"], "content": message["content"]}
        for message in (history[-2:] if is_follow_up else [])
        if message["role"] in {"user", "assistant"}
    ][-4:]
    context = _analytics_context(question, records, scope)
    findings = _verified_findings(question, context)
    conversation.append(
        {
            "role": "user",
            "content": (
                f"Question: {question}\n"
                f"Current database analytics evidence:\n"
                f"{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}"
            ),
        }
    )

    try:
        result = await Runner.run(
            starting_agent=_create_student_analytics_agent(),
            input=conversation,
        )
    except ModelBehaviorError as error:
        logger.warning(
            "Sarvam returned no usable educational interpretation: %s", error
        )
        return findings, False

    answer = str(result.final_output).strip()
    if not answer:
        raise RuntimeError("Student analytics returned an empty answer.")
    return f"{findings}\n\n## Educational analyst interpretation\n{answer}", True
