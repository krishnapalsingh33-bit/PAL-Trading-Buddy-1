import os

from dotenv import load_dotenv

load_dotenv()

TV_USERNAME = os.getenv("TV_USERNAME")
TV_PASSWORD = os.getenv("TV_PASSWORD")