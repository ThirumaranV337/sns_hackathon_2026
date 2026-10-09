import os
from functools import lru_cache

from agents import Agent, ModelSettings, OpenAIChatCompletionsModel, Runner
from openai import AsyncOpenAI


SARVAM_BASE_URL = "https://api.sarvam.ai/v1"
SARVAM_MODEL = "sarvam-105b"


class StudyAssistantConfigurationError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _create_study_agent() -> Agent:
    api_key = os.getenv("SARAVAM_API")
    if not api_key:
        raise StudyAssistantConfigurationError(
            "Set SARAVAM_API in the backend environment to enable the study assistant."
        )

    client = AsyncOpenAI(base_url=SARVAM_BASE_URL, api_key=api_key)
    model = OpenAIChatCompletionsModel(
        model=SARVAM_MODEL,
        openai_client=client,
    )
    return Agent(
        name="CampusFlow AI Study Assistant",
        instructions=(
            "You are a helpful study assistant for college students. Explain "
            "concepts accurately in clear, student-friendly language. Use "
            "well-structured answers with brief headings or steps when useful. "
            "Answer follow-up questions using the conversation context. If a "
            "question is ambiguous, state what you are assuming or ask one "
            "focused clarification. Do not fabricate sources, facts, or "
            "student-record data. Be concise while providing enough explanation "
            "to help the student learn."
        ),
        model=model,
        model_settings=ModelSettings(max_tokens=2000),
    )


async def answer_study_question(
    question: str, history: list[dict[str, str]]
) -> str:
    conversation = [
        {"role": message["role"], "content": message["content"]}
        for message in history
        if message["role"] in {"user", "assistant"}
    ]
    conversation.append({"role": "user", "content": question})

    agent = _create_study_agent()
    result = await Runner.run(starting_agent=agent, input=conversation)
    response = result.final_output
    if isinstance(response, str):
        answer = response.strip()
    elif hasattr(response, "model_dump_json"):
        answer = response.model_dump_json().strip()
    else:
        answer = str(response).strip()

    if not answer:
        raise RuntimeError("The study assistant returned an empty answer.")
    return answer
