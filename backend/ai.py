import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


def ask_ai(prompt):

    response = client.responses.create(
        model="gpt-5.6",
        input=prompt,
    )

    return response.output_text
