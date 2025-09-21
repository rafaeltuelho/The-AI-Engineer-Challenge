from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()


class ChatOpenAI:
    def __init__(self, model_name: str = "gpt-4.1-mini", api_key: str = None):
        self.model_name = model_name
        # Use provided API key or fall back to environment variable
        self.openai_api_key = api_key or os.getenv("OPENAI_API_KEY")
        if self.openai_api_key is None:
            raise ValueError("OpenAI API key must be provided either as parameter or OPENAI_API_KEY environment variable")

    def run(self, messages, text_only: bool = True, **kwargs):
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        client = OpenAI(api_key=self.openai_api_key)
        response = client.chat.completions.create(
            model=self.model_name, messages=messages, **kwargs
            temperature=0.7,
            # max_tokens=4096,
            # top_p=1,
            # frequency_penalty=0,
            # presence_penalty=0,
            # stop=None,
            # n=1,
        )

        if text_only:
            return response.choices[0].message.content

        return response
    
    async def arun(self, messages, text_only: bool = True, **kwargs):
        """Async version of run method."""
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        client = OpenAI(api_key=self.openai_api_key)
        response = await client.chat.completions.create(
            model=self.model_name, messages=messages, **kwargs
            temperature=0.7,
            # max_tokens=4096,
            # top_p=1,
            # frequency_penalty=0,
            # presence_penalty=0,
            # stop=None,
            # n=1,
        )

        if text_only:
            return response.choices[0].message.content

        return response