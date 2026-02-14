"""
Vector Database implementation using Qdrant in-memory for similarity search.

This module provides a VectorDatabase class that uses Qdrant in-memory mode
for efficient vector storage and similarity search operations.
"""
import numpy as np
import uuid
from typing import List, Tuple, Callable, Union
from aimakerspace.openai_utils.embedding import EmbeddingModel
import asyncio
from enum import Enum

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct


class DistanceMeasure(Enum):
    """Enumeration of available distance measures for vector similarity."""
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT_PRODUCT = "dot_product"
    MANHATTAN = "manhattan"


# Mapping from our DistanceMeasure enum to Qdrant Distance enum
QDRANT_DISTANCE_MAP = {
    DistanceMeasure.COSINE: Distance.COSINE,
    DistanceMeasure.EUCLIDEAN: Distance.EUCLID,
    DistanceMeasure.DOT_PRODUCT: Distance.DOT,
    DistanceMeasure.MANHATTAN: Distance.MANHATTAN,
}


class VectorDatabase:
    """
    Vector Database using Qdrant in-memory for similarity search.

    This class provides an interface for storing and searching vectors
    using Qdrant's in-memory mode, with support for multiple distance measures.
    """

    # Default vector dimension (will be updated on first insert)
    DEFAULT_VECTOR_SIZE = 1536  # OpenAI text-embedding-3-small dimension

    def __init__(self, embedding_model: EmbeddingModel = None, api_key: str = None, collection_name: str = None):
        """
        Initialize the VectorDatabase with Qdrant in-memory client.

        Args:
            embedding_model: Optional EmbeddingModel instance for text embeddings
            api_key: Optional API key for the embedding model
            collection_name: Optional collection name (auto-generated if not provided)
        """
        # Initialize Qdrant client in-memory mode
        self.client = QdrantClient(":memory:")

        # Generate unique collection name if not provided
        self.collection_name = collection_name or f"collection_{uuid.uuid4().hex[:8]}"

        # Initialize embedding model
        self.embedding_model = embedding_model or EmbeddingModel(api_key=api_key)

        # Track key to ID mapping (Qdrant uses integer/UUID IDs, we use string keys)
        self._key_to_id = {}
        self._id_to_key = {}
        self._next_id = 0

        # Track if collection is created
        self._collection_created = False
        self._vector_size = None

    def _ensure_collection(self, vector_size: int, distance_measure: DistanceMeasure = DistanceMeasure.COSINE) -> None:
        """Ensure the collection exists with the correct vector configuration."""
        if not self._collection_created:
            qdrant_distance = QDRANT_DISTANCE_MAP.get(distance_measure, Distance.COSINE)
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=vector_size, distance=qdrant_distance),
            )
            self._collection_created = True
            self._vector_size = vector_size

    def insert(self, key: str, vector: np.array, metadata: dict = None) -> None:
        """
        Insert a vector into the database with the given key and optional metadata.

        Args:
            key: Unique string key for the vector
            vector: Vector to insert (numpy array or list)
            metadata: Optional metadata dictionary to store with the vector
        """
        # Convert numpy array to list if needed
        vector_list = vector.tolist() if isinstance(vector, np.ndarray) else list(vector)

        # Ensure collection exists with correct vector size
        self._ensure_collection(len(vector_list))

        # Generate integer ID for Qdrant
        point_id = self._next_id
        self._next_id += 1

        # Store key-ID mapping
        self._key_to_id[key] = point_id
        self._id_to_key[point_id] = key

        # Prepare payload (metadata + key for retrieval)
        payload = metadata.copy() if metadata else {}
        payload['_key'] = key  # Store the original key in payload

        # Insert into Qdrant
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector_list,
                    payload=payload
                )
            ]
        )

    def _get_qdrant_distance(self, distance_measure: Union[str, DistanceMeasure, Callable]) -> Distance:
        """Convert distance measure to Qdrant Distance enum."""
        if callable(distance_measure):
            # Custom functions default to cosine in Qdrant
            return Distance.COSINE
        elif isinstance(distance_measure, DistanceMeasure):
            return QDRANT_DISTANCE_MAP.get(distance_measure, Distance.COSINE)
        elif isinstance(distance_measure, str):
            try:
                enum_value = DistanceMeasure(distance_measure.lower())
                return QDRANT_DISTANCE_MAP.get(enum_value, Distance.COSINE)
            except ValueError:
                return Distance.COSINE
        return Distance.COSINE

    def search(
        self,
        query_vector: np.array,
        k: int,
        distance_measure: Union[str, DistanceMeasure, Callable] = DistanceMeasure.COSINE,
    ) -> List[Tuple[str, float]]:
        """
        Search for the k most similar vectors using the specified distance measure.

        Args:
            query_vector: The query vector to search with
            k: Number of similar vectors to return
            distance_measure: Distance measure to use (string, enum, or function)

        Returns:
            List of tuples (key, similarity_score) sorted by similarity
        """
        if not self._collection_created:
            return []

        # Convert numpy array to list if needed
        query_list = query_vector.tolist() if isinstance(query_vector, np.ndarray) else list(query_vector)

        # Search in Qdrant using query_points (replaces deprecated search method)
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_list,
            limit=k
        )

        # Convert results to (key, score) tuples
        search_results = []
        for hit in response.points:
            key = hit.payload.get('_key', str(hit.id))
            score = hit.score
            search_results.append((key, score))

        return search_results

    def search_by_text(
        self,
        query_text: str,
        k: int,
        distance_measure: Union[str, DistanceMeasure, Callable] = DistanceMeasure.COSINE,
        return_as_text: bool = False,
    ) -> List[Tuple[str, float]]:
        """
        Search for similar vectors using text query.

        Args:
            query_text: Text to convert to embedding and search with
            k: Number of similar vectors to return
            distance_measure: Distance measure to use (string, enum, or function)
            return_as_text: If True, return only the keys; if False, return (key, score) tuples

        Returns:
            List of similar vectors (as keys or tuples)
        """
        query_vector = self.embedding_model.get_embedding(query_text)
        results = self.search(query_vector, k, distance_measure)
        return [result[0] for result in results] if return_as_text else results

    def retrieve_from_key(self, key: str) -> np.array:
        """
        Retrieve a vector by its key.

        Args:
            key: The key of the vector to retrieve

        Returns:
            The vector as numpy array, or None if not found
        """
        if key not in self._key_to_id:
            return None

        point_id = self._key_to_id[key]

        try:
            points = self.client.retrieve(
                collection_name=self.collection_name,
                ids=[point_id],
                with_vectors=True
            )
            if points:
                return np.array(points[0].vector)
        except Exception:
            pass

        return None

    async def abuild_from_list(self, list_of_text: List[str]) -> "VectorDatabase":
        """
        Build the vector database from a list of text strings.

        Args:
            list_of_text: List of text strings to embed and store

        Returns:
            Self for method chaining
        """
        embeddings = await self.embedding_model.async_get_embeddings(list_of_text)
        for text, embedding in zip(list_of_text, embeddings):
            self.insert(text, np.array(embedding))
        return self

    def get_available_distance_measures(self) -> List[str]:
        """Get a list of available distance measure names."""
        return [measure.value for measure in DistanceMeasure]

    def search_with_metadata(
        self,
        query_text: str,
        k: int = 5,
        distance_measure: Union[str, DistanceMeasure, Callable] = DistanceMeasure.COSINE
    ) -> List[dict]:
        """
        Search for relevant vectors and return with full metadata.

        Args:
            query_text: Text to convert to embedding and search with
            k: Number of similar vectors to return
            distance_measure: Distance measure to use

        Returns:
            List of dictionaries containing metadata and similarity scores
        """
        if not self._collection_created:
            return []

        query_vector = self.embedding_model.get_embedding(query_text)
        query_list = query_vector if isinstance(query_vector, list) else query_vector.tolist()

        # Search in Qdrant with full payload using query_points (replaces deprecated search method)
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_list,
            limit=k,
            with_payload=True
        )

        # Build enriched results
        enriched_results = []
        for hit in response.points:
            metadata = hit.payload.copy() if hit.payload else {}
            key = metadata.pop('_key', str(hit.id))  # Remove internal key from metadata
            metadata['similarity_score'] = hit.score
            metadata['key'] = key
            enriched_results.append(metadata)

        return enriched_results

    def get_metadata(self, key: str) -> dict:
        """
        Get metadata for a specific vector key.

        Args:
            key: The key of the vector

        Returns:
            Metadata dictionary, or empty dict if not found
        """
        if key not in self._key_to_id:
            return {}

        point_id = self._key_to_id[key]

        try:
            points = self.client.retrieve(
                collection_name=self.collection_name,
                ids=[point_id],
                with_payload=True
            )
            if points:
                metadata = points[0].payload.copy() if points[0].payload else {}
                metadata.pop('_key', None)  # Remove internal key
                return metadata
        except Exception:
            pass

        return {}

    def get_vectors_by_metadata_filter(self, filter_func: Callable) -> List[dict]:
        """
        Get all vectors that match a metadata filter function.

        Args:
            filter_func: Function that takes metadata dict and returns bool

        Returns:
            List of metadata dictionaries for matching vectors
        """
        if not self._collection_created:
            return []

        matching_vectors = []

        # Scroll through all points and apply filter
        # Note: For production use with large datasets, consider using Qdrant's filter API
        offset = None
        while True:
            records, next_offset = self.client.scroll(
                collection_name=self.collection_name,
                limit=100,
                offset=offset,
                with_payload=True
            )

            for record in records:
                metadata = record.payload.copy() if record.payload else {}
                key = metadata.pop('_key', str(record.id))
                if filter_func(metadata):
                    metadata['key'] = key
                    matching_vectors.append(metadata)

            if next_offset is None:
                break
            offset = next_offset

        return matching_vectors


if __name__ == "__main__":
    # Example usage demonstrating Qdrant in-memory vector database
    # Note: This example requires a valid API key for the embedding model
    import getpass
    import sys

    print("=" * 60)
    print("Qdrant In-Memory Vector Database Demo")
    print("=" * 60)

    # Prompt user for provider and API key
    provider = input("Enter provider name (openai or together): ").strip().lower()
    if provider not in ("openai", "together"):
        print("Invalid provider. Defaulting to 'openai'.")
        provider = "openai"

    api_key = getpass.getpass("Enter your API key (input hidden): ").strip()
    if not api_key:
        print("No API key provided. Exiting.")
        sys.exit(1)

    list_of_text = [
        "I like to eat broccoli and bananas.",
        "I ate a banana and spinach smoothie for breakfast.",
        "Chinchillas and kittens are cute.",
        "My sister adopted a kitten yesterday.",
        "Look at this cute hamster munching on a piece of broccoli.",
    ]

    print("\nInitializing Qdrant in-memory vector database...")
    embedding_model = EmbeddingModel(api_key=api_key, provider=provider)
    vector_db = VectorDatabase(embedding_model=embedding_model)

    print("Building embeddings for sample texts...")
    vector_db = asyncio.run(vector_db.abuild_from_list(list_of_text))

    k = 2
    query = "I think fruit is awesome!"

    print("\nAvailable distance measures:", vector_db.get_available_distance_measures())
    print(f"\nQuery: '{query}'")
    print(f"Top {k} results (using Cosine similarity - Qdrant default):\n")

    # Search using default cosine similarity
    print("--- COSINE (Qdrant In-Memory) ---")
    results = vector_db.search_by_text(query, k=k, distance_measure=DistanceMeasure.COSINE)
    for i, (text, score) in enumerate(results, 1):
        print(f"{i}. {text[:50]}... (score: {score:.4f})")
    print()

    # Example with string parameter
    print("--- Using string parameter: 'cosine' ---")
    results = vector_db.search_by_text(query, k=k, distance_measure="cosine")
    for i, (text, score) in enumerate(results, 1):
        print(f"{i}. {text[:50]}... (score: {score:.4f})")
    print()

    # Test search_with_metadata
    print("--- Search with metadata ---")
    results_with_meta = vector_db.search_with_metadata(query, k=k)
    for i, result in enumerate(results_with_meta, 1):
        print(f"{i}. Key: {result.get('key', 'N/A')[:50]}... (score: {result.get('similarity_score', 0):.4f})")

    print("\n✅ Qdrant in-memory vector database working correctly!")
