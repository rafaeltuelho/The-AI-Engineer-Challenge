from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
import openai
from together import Together
import ollama
from typing import List, Optional
import os
import asyncio

class EmbeddingModel:
    def __init__(self, batch_size: int = 1024, api_key: str = None, provider: str = "openai", base_url: str = None, embedding_model: str = None):
        load_dotenv()
        self.provider = provider.lower()
        self.api_key = api_key
        self.base_url = base_url

        # Validate requirements based on provider
        if self.provider == "ollama":
            if not self.base_url:
                raise ValueError("Base URL is required for Ollama provider")
            # No API key required for Ollama
            self.api_key = "ollama"  # Dummy key for compatibility
        else:
            if self.api_key is None:
                raise ValueError(
                    f"{self.provider.title()} API key must be provided either as parameter or environment variable."
                )

        self.batch_size = batch_size

        # Initialize clients based on provider
        if self.provider == "together":
            self.async_client = None  # Together.ai doesn't have async client in this version
            # https://docs.together.ai/docs/serverless-models#embedding-models
            self.embeddings_model_name = embedding_model or "togethercomputer/m2-bert-80M-32k-retrieval"
            self.client = Together(api_key=self.api_key)
        elif self.provider == "ollama":
            self.async_client = ollama.AsyncClient(host=self.base_url)
            self.client = ollama.Client(host=self.base_url)
            # Default embedding model for Ollama - can be overridden
            self.embeddings_model_name = embedding_model or "nomic-embed-text:latest"
        else:
            # Default to OpenAI
            self.embeddings_model_name = embedding_model or "text-embedding-3-small"
            self.async_client = AsyncOpenAI(api_key=self.api_key)
            self.client = OpenAI(api_key=self.api_key)

    async def async_get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        if self.provider == "together":
            # Together.ai doesn't have async support, fall back to sync
            return self.get_embeddings(list_of_text)
        elif self.provider == "ollama":
            # Use Ollama async client
            embeddings = []
            for text in list_of_text:
                response = await self.async_client.embeddings(
                    model=self.embeddings_model_name,
                    prompt=text
                )
                embeddings.append(response['embedding'])
            return embeddings

        batches = [list_of_text[i:i + self.batch_size] for i in range(0, len(list_of_text), self.batch_size)]

        async def process_batch(batch):
            embedding_response = await self.async_client.embeddings.create(
                input=batch, model=self.embeddings_model_name
            )
            return [embeddings.embedding for embeddings in embedding_response.data]

        # Use asyncio.gather to process all batches concurrently
        results = await asyncio.gather(*[process_batch(batch) for batch in batches])

        # Flatten the results
        return [embedding for batch_result in results for embedding in batch_result]

    async def async_get_embedding(self, text: str) -> List[float]:
        if self.provider == "together":
            # Together.ai doesn't have async support, fall back to sync
            return self.get_embedding(text)
        elif self.provider == "ollama":
            # Use Ollama async client
            response = await self.async_client.embeddings(
                model=self.embeddings_model_name,
                prompt=text
            )
            return response['embedding']

        embedding = await self.async_client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding

    def get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        if self.provider == "together":
            embedding_response = self.client.embeddings.create(
                model=self.embeddings_model_name,
                input=list_of_text
            )
            return [embeddings.embedding for embeddings in embedding_response.data]
        elif self.provider == "ollama":
            # Use Ollama client
            embeddings = []
            for text in list_of_text:
                response = self.client.embeddings(
                    model=self.embeddings_model_name,
                    prompt=text
                )
                embeddings.append(response['embedding'])
            return embeddings
        else:
            embedding_response = self.client.embeddings.create(
                input=list_of_text, model=self.embeddings_model_name
            )
            return [embeddings.embedding for embeddings in embedding_response.data]

    def get_embedding(self, text: str) -> List[float]:
        if self.provider == "together":
            embedding = self.client.embeddings.create(
                input=text, model=self.embeddings_model_name
            )
            return embedding.data[0].embedding
        elif self.provider == "ollama":
            # Use Ollama client
            response = self.client.embeddings(
                model=self.embeddings_model_name,
                prompt=text
            )
            return response['embedding']
        else:
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
