from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
from together import Together
from typing import List, Optional
import os
import asyncio

class EmbeddingModel:
    def __init__(self, batch_size: int = 1024, api_key: str = None, provider: str = "openai"):
        load_dotenv()
        self.provider = provider.lower()
        self.api_key = api_key #or os.getenv("OPENAI_API_KEY")
        
        if self.api_key is None:
            raise ValueError(
                f"{self.provider.title()} API key must be provided either as parameter or environment variable."
            )
        
        self.batch_size = batch_size
        
        # Initialize clients based on provider
        if self.provider == "together":
            self.async_client = None  # Together.ai doesn't have async client in this version
            # https://docs.together.ai/docs/serverless-models#embedding-models
            # Available serverless embedding models:
            # - BAAI/bge-base-en-v1.5 (768 dim, 512 context) - too small for 1000 token chunks
            # - Alibaba-NLP/gte-modernbert-base (768 dim, 8192 context) - good for large chunks
            # - intfloat/multilingual-e5-large-instruct (1024 dim, 514 context) - too small
            # Using gte-modernbert-base for larger context window (8192 tokens)
            self.embeddings_model_name = "Alibaba-NLP/gte-modernbert-base"
            self.client = Together(api_key=self.api_key)
        else:
            # Default to OpenAI
            self.embeddings_model_name = "text-embedding-3-small"
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
            embedding_response = self.client.embeddings.create(
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
            embedding = self.client.embeddings.create(
                input=text, model=self.embeddings_model_name
            )
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
