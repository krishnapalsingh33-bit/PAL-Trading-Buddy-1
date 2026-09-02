import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def _client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OpenAI is not configured. Set OPENAI_API_KEY to use PAL's AI assistant."
        )
    return OpenAI(api_key=api_key)


def ask_ai(prompt):
    response = _client().responses.create(
        model="gpt-5.6",
        input=prompt,
    )
    return response.output_text
