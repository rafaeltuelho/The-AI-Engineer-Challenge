from openai import OpenAI
from dotenv import load_dotenv
import os
from typing import Optional

load_dotenv()


class ChatOpenAI:
    def __init__(self, api_key: str = None, provider: str = "openai", ollama_base_url: str = None):
        self.provider = provider.lower()
        self.api_key = api_key  # or os.getenv("OPENAI_API_KEY")
        self.ollama_base_url = ollama_base_url

        # Ollama doesn't require an API key
        if self.provider != "ollama" and self.api_key is None:
            raise ValueError(
                f"{self.provider.title()} API key must be provided either as "
                "parameter or environment variable"
            )

        # Validate Ollama configuration
        if self.provider == "ollama" and not ollama_base_url:
            raise ValueError(
                "Ollama base URL must be provided when using Ollama provider"
            )

        # Set base URL based on provider
        if self.provider == "together":
            self.base_url = "https://api.together.xyz/v1"
        elif self.provider == "ollama":
            self.base_url = ollama_base_url
        else:
            self.base_url = None  # Use default OpenAI base URL

    def run(
        self,
        messages,
        model_name: str = "gpt-4.1-mini",
        text_only: bool = True,
        **kwargs
    ):
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        # Initialize client with appropriate base URL
        # Ollama doesn't require an API key, use a dummy one
        api_key = self.api_key if self.api_key else "ollama"
        client_kwargs = {"api_key": api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url

        client = OpenAI(**client_kwargs)
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            **kwargs,
        )

        if text_only:
            return response.choices[0].message.content

        return response

    async def arun(
        self,
        messages,
        model_name: str = "gpt-4.1-mini",
        text_only: bool = True,
        **kwargs
    ):
        """Async version of run method."""
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        # Initialize client with appropriate base URL
        # Ollama doesn't require an API key, use a dummy one
        api_key = self.api_key if self.api_key else "ollama"
        client_kwargs = {"api_key": api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url

        client = OpenAI(**client_kwargs)
        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            **kwargs
        )

        if text_only:
            return response.choices[0].message.content

        return response
