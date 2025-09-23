from openai import OpenAI
from dotenv import load_dotenv
import os
from typing import Optional

load_dotenv()


class ChatOpenAI:
    def __init__(self, api_key: str = None, provider: str = "openai"):
        """
        Initialize ChatOpenAI with support for multiple providers.
        
        Args:
            api_key: API key for the provider
            provider: Provider name ("openai" or "together")
        """
        self.provider = provider.lower()
        self.api_key = api_key #or os.getenv("OPENAI_API_KEY")
        
        if self.api_key is None:
            raise ValueError(f"{self.provider.title()} API key must be provided either as parameter or environment variable")
        
        # Set base URL based on provider
        if self.provider == "together":
            self.base_url = "https://api.together.xyz/v1"
        else:
            self.base_url = None  # Use default OpenAI base URL

    def run(self, messages, model_name: str = "gpt-4.1-mini", text_only: bool = True, **kwargs):
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        # Initialize client with appropriate base URL
        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
            
        client = OpenAI(**client_kwargs)
        response = client.chat.completions.create(
            model=model_name, 
            messages=messages, 
            # temperature=0.7,
            **kwargs,
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
    
    async def arun(self, messages, model_name: str = "gpt-4.1-mini", text_only: bool = True, **kwargs):
        """Async version of run method."""
        if not isinstance(messages, list):
            raise ValueError("messages must be a list")

        # Initialize client with appropriate base URL
        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
            
        client = OpenAI(**client_kwargs)
        response = await client.chat.completions.create(
            model=model_name, 
            messages=messages, 
            # temperature=0.7,
            **kwargs
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