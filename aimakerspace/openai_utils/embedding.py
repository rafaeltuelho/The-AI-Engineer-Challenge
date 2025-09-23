from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
import openai
from typing import List, Optional
import os
import asyncio

try:
    import together
except ImportError:
    together = None


class EmbeddingModel:
    def __init__(self, embeddings_model_name: str = "text-embedding-3-small", batch_size: int = 1024, api_key: str = None, provider: str = "openai"):
        load_dotenv()
        self.provider = provider.lower()
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        
        if self.api_key is None:
            raise ValueError(
                f"{self.provider.title()} API key must be provided either as parameter or environment variable."
            )
        
        self.embeddings_model_name = embeddings_model_name
        self.batch_size = batch_size
        
        # Initialize clients based on provider
        if self.provider == "together":
            if together is None:
                raise ImportError("Together.ai client library is required. Install with: pip install together")
            # Set API key for Together.ai
            together.api_key = self.api_key
            self.async_client = None  # Together.ai doesn't have async client in this version
            self.client = together.Embeddings()
        else:
            # Default to OpenAI
            self.async_client = AsyncOpenAI(api_key=self.api_key)
            self.client = OpenAI(api_key=self.api_key)

    async def async_get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        if self.provider == "together":
            # Together.ai doesn't have async support, fall back to sync
            return self.get_embeddings(list_of_text)
        
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
        
        embedding = await self.async_client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding

    def get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        if self.provider == "together":
            embedding_response = self.client.create(
                model=self.embeddings_model_name,
                input=list_of_text
            )
        else:
            embedding_response = self.client.embeddings.create(
                input=list_of_text, model=self.embeddings_model_name
            )

        return [embeddings.embedding for embeddings in embedding_response.data]

    def get_embedding(self, text: str) -> List[float]:
        if self.provider == "together":
            embedding = self.client.create(
                model=self.embeddings_model_name,
                input=text
            )
        else:
            embedding = self.client.embeddings.create(
                input=text, model=self.embeddings_model_name
            )

        return embedding.data[0].embedding


if __name__ == "__main__":
    embedding_model = EmbeddingModel()
    print(asyncio.run(embedding_model.async_get_embedding("Hello, world!")))
    print(
        asyncio.run(
            embedding_model.async_get_embeddings(["Hello, world!", "Goodbye, world!"])
        )
    )
