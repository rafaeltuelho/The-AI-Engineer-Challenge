from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
import openai
from together import Together
from typing import List, Optional
import os
import asyncio

class EmbeddingModel:
    def __init__(
        self,
        batch_size: int = 1024,
        api_key: str = None,
        provider: str = "openai",
        ollama_base_url: str = None
    ):
        load_dotenv()
        self.provider = provider.lower()
        self.api_key = api_key  # or os.getenv("OPENAI_API_KEY")
        self.ollama_base_url = ollama_base_url

        # Ollama doesn't require an API key
        if self.provider != "ollama" and self.api_key is None:
            raise ValueError(
                f"{self.provider.title()} API key must be provided either as "
                "parameter or environment variable."
            )

        # Validate Ollama configuration
        if self.provider == "ollama" and not ollama_base_url:
            raise ValueError(
                "Ollama base URL must be provided when using Ollama provider"
            )

        self.batch_size = batch_size

        # Initialize clients based on provider
        if self.provider == "together":
            self.async_client = None  # Together.ai doesn't have async
            # https://docs.together.ai/docs/serverless-models#embedding-models
            self.embeddings_model_name = "togethercomputer/m2-bert-80M-32k-retrieval"
            self.client = Together(api_key=self.api_key)
        elif self.provider == "ollama":
            # Ollama uses local embeddings model
            self.async_client = None  # Ollama doesn't have async in this version
            self.embeddings_model_name = "nomic-embed-text"  # Default Ollama embedding
            # Use OpenAI client with Ollama base URL
            api_key_dummy = "ollama"  # Dummy key for Ollama
            self.client = OpenAI(api_key=api_key_dummy, base_url=ollama_base_url)
        else:
            # Default to OpenAI
            self.embeddings_model_name = "text-embedding-3-small"
            self.async_client = AsyncOpenAI(api_key=self.api_key)
            self.client = OpenAI(api_key=self.api_key)

    async def async_get_embeddings(
        self, list_of_text: List[str]
    ) -> List[List[float]]:
        # Together.ai and Ollama don't have async support, fall back to sync
        if self.provider in ("together", "ollama"):
            return self.get_embeddings(list_of_text)

        batches = [
            list_of_text[i : i + self.batch_size]
            for i in range(0, len(list_of_text), self.batch_size)
        ]

        async def process_batch(batch):
            embedding_response = await self.async_client.embeddings.create(
                input=batch, model=self.embeddings_model_name
            )
            return [embeddings.embedding for embeddings in embedding_response.data]

        # Use asyncio.gather to process all batches concurrently
        results = await asyncio.gather(
            *[process_batch(batch) for batch in batches]
        )

        # Flatten the results
        return [
            embedding for batch_result in results for embedding in batch_result
        ]

    async def async_get_embedding(self, text: str) -> List[float]:
        # Together.ai and Ollama don't have async support, fall back to sync
        if self.provider in ("together", "ollama"):
            return self.get_embedding(text)

        embedding = await self.async_client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding

    def get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        if self.provider == "together":
            embedding_response = self.client.embeddings.create(
                model=self.embeddings_model_name, input=list_of_text
            )
        else:
            # Works for both OpenAI and Ollama
            embedding_response = self.client.embeddings.create(
                input=list_of_text, model=self.embeddings_model_name
            )

        return [embeddings.embedding for embeddings in embedding_response.data]

    def get_embedding(self, text: str) -> List[float]:
        if self.provider == "together":
            embedding = self.client.embeddings.create(
                input=text, model=self.embeddings_model_name
            )
        else:
            # Works for both OpenAI and Ollama
            embedding = self.client.embeddings.create(
                input=text, model=self.embeddings_model_name
            )

        return embedding.data[0].embedding


if __name__ == "__main__":
    # Read provider name from stdin and create an EmbeddingModel with it
    import sys
    # Read API key securely from stdin without echoing (for security)
    import getpass

    # Prompt user for provider name
    provider = input("Enter provider name (openai or together): ").strip().lower()
    if provider not in ("openai", "together"):
        print("Invalid provider. Defaulting to 'openai'.")
        provider = "openai"
    
    api_key = getpass.getpass("Enter your API key (input hidden): ").strip()
    if not api_key:
        print("No API key provided. Exiting.")
        sys.exit(1)

    # Choose embedding model name based on provider using inline if-else
    embedding_model = EmbeddingModel(provider=provider, api_key=api_key)
    print(asyncio.run(embedding_model.async_get_embedding("Hello, world!")))
    print(
        asyncio.run(
            embedding_model.async_get_embeddings(["Hello, world!", "Goodbye, world!"])
        )
    )
