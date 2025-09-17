import numpy as np
from collections import defaultdict
from typing import List, Tuple, Callable, Union
from aimakerspace.openai_utils.embedding import EmbeddingModel
import asyncio
from enum import Enum


class DistanceMeasure(Enum):
    """Enumeration of available distance measures for vector similarity."""
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT_PRODUCT = "dot_product"
    MANHATTAN = "manhattan"


def cosine_similarity(vector_a: np.array, vector_b: np.array) -> float:
    """Computes the cosine similarity between two vectors.
    
    Args:
        vector_a: First vector
        vector_b: Second vector
        
    Returns:
        Cosine similarity score between -1 and 1 (higher is more similar)
    """
    dot_product = np.dot(vector_a, vector_b)
    norm_a = np.linalg.norm(vector_a)
    norm_b = np.linalg.norm(vector_b)
    return dot_product / (norm_a * norm_b)


def euclidean_distance(vector_a: np.array, vector_b: np.array) -> float:
    """Computes the Euclidean distance between two vectors.
    
    Args:
        vector_a: First vector
        vector_b: Second vector
        
    Returns:
        Euclidean distance (lower is more similar)
    """
    return np.linalg.norm(vector_a - vector_b)


def dot_product_similarity(vector_a: np.array, vector_b: np.array) -> float:
    """Computes the dot product between two vectors.
    
    Args:
        vector_a: First vector
        vector_b: Second vector
        
    Returns:
        Dot product (higher is more similar, but not normalized)
    """
    return np.dot(vector_a, vector_b)


def manhattan_distance(vector_a: np.array, vector_b: np.array) -> float:
    """Computes the Manhattan (L1) distance between two vectors.
    
    Args:
        vector_a: First vector
        vector_b: Second vector
        
    Returns:
        Manhattan distance (lower is more similar)
    """
    return np.sum(np.abs(vector_a - vector_b))


# Distance measure registry
DISTANCE_MEASURES = {
    DistanceMeasure.COSINE: cosine_similarity,
    DistanceMeasure.EUCLIDEAN: euclidean_distance,
    DistanceMeasure.DOT_PRODUCT: dot_product_similarity,
    DistanceMeasure.MANHATTAN: manhattan_distance,
}


class VectorDatabase:
    def __init__(self, embedding_model: EmbeddingModel = None):
        self.vectors = defaultdict(np.array)
        self.embedding_model = embedding_model or EmbeddingModel()
        self.metadata = {}  # Store metadata for each vector

    def insert(self, key: str, vector: np.array, metadata: dict = None) -> None:
        """Insert a vector into the database with the given key and optional metadata."""
        self.vectors[key] = vector
        if metadata is not None:
            self.metadata[key] = metadata

    def _get_distance_function(self, distance_measure: Union[str, DistanceMeasure, Callable]) -> Callable:
        """Get the distance function from various input types.
        
        Args:
            distance_measure: Can be a string, DistanceMeasure enum, or callable function
            
        Returns:
            The distance function to use
            
        Raises:
            ValueError: If the distance measure is not recognized
        """
        if callable(distance_measure):
            return distance_measure
        elif isinstance(distance_measure, DistanceMeasure):
            return DISTANCE_MEASURES[distance_measure]
        elif isinstance(distance_measure, str):
            try:
                enum_value = DistanceMeasure(distance_measure.lower())
                return DISTANCE_MEASURES[enum_value]
            except ValueError:
                raise ValueError(f"Unknown distance measure: {distance_measure}. "
                               f"Available options: {[d.value for d in DistanceMeasure]}")
        else:
            raise ValueError(f"Invalid distance measure type: {type(distance_measure)}")

    def search(
        self,
        query_vector: np.array,
        k: int,
        distance_measure: Union[str, DistanceMeasure, Callable] = DistanceMeasure.COSINE,
    ) -> List[Tuple[str, float]]:
        """Search for the k most similar vectors using the specified distance measure.
        
        Args:
            query_vector: The query vector to search with
            k: Number of similar vectors to return
            distance_measure: Distance measure to use (string, enum, or function)
            
        Returns:
            List of tuples (key, similarity_score) sorted by similarity
        """
        distance_func = self._get_distance_function(distance_measure)
        scores = [
            (key, distance_func(query_vector, vector))
            for key, vector in self.vectors.items()
        ]
        
        # For distance measures (Euclidean, Manhattan), lower is better
        # For similarity measures (Cosine, Dot Product), higher is better
        is_distance_measure = distance_measure in [DistanceMeasure.EUCLIDEAN, DistanceMeasure.MANHATTAN] or \
                             (isinstance(distance_measure, str) and distance_measure.lower() in ['euclidean', 'manhattan'])
        
        return sorted(scores, key=lambda x: x[1], reverse=not is_distance_measure)[:k]

    def search_by_text(
        self,
        query_text: str,
        k: int,
        distance_measure: Union[str, DistanceMeasure, Callable] = DistanceMeasure.COSINE,
        return_as_text: bool = False,
    ) -> List[Tuple[str, float]]:
        """Search for similar vectors using text query.
        
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
        """Retrieve a vector by its key."""
        return self.vectors.get(key, None)

    async def abuild_from_list(self, list_of_text: List[str]) -> "VectorDatabase":
        """Build the vector database from a list of text strings."""
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
        # Get search results from vector database
        results = self.search_by_text(query_text, k, distance_measure)
        
        # Enrich with metadata
        enriched_results = []
        for key, similarity_score in results:
            metadata = self.metadata.get(key, {}).copy()
            metadata['similarity_score'] = similarity_score
            metadata['key'] = key
            enriched_results.append(metadata)
        
        return enriched_results
    
    def get_metadata(self, key: str) -> dict:
        """Get metadata for a specific vector key."""
        return self.metadata.get(key, {})
    
    def get_vectors_by_metadata_filter(self, filter_func: callable) -> List[dict]:
        """
        Get all vectors that match a metadata filter function.
        
        Args:
            filter_func: Function that takes metadata dict and returns bool
            
        Returns:
            List of metadata dictionaries for matching vectors
        """
        matching_vectors = []
        for key, metadata in self.metadata.items():
            if filter_func(metadata):
                matching_vectors.append(metadata)
        return matching_vectors


if __name__ == "__main__":
    # Example usage demonstrating different distance measures
    list_of_text = [
        "I like to eat broccoli and bananas.",
        "I ate a banana and spinach smoothie for breakfast.",
        "Chinchillas and kittens are cute.",
        "My sister adopted a kitten yesterday.",
        "Look at this cute hamster munching on a piece of broccoli.",
    ]

    vector_db = VectorDatabase()
    vector_db = asyncio.run(vector_db.abuild_from_list(list_of_text))
    k = 2
    query = "I think fruit is awesome!"

    print("Available distance measures:", vector_db.get_available_distance_measures())
    print(f"\nQuery: '{query}'")
    print(f"Top {k} results for each distance measure:\n")

    # Test all distance measures
    for measure in DistanceMeasure:
        print(f"--- {measure.value.upper()} ---")
        results = vector_db.search_by_text(query, k=k, distance_measure=measure)
        for i, (text, score) in enumerate(results, 1):
            print(f"{i}. {text[:50]}... (score: {score:.4f})")
        print()

    # Example with string parameter
    print("--- Using string parameter: 'euclidean' ---")
    results = vector_db.search_by_text(query, k=k, distance_measure="euclidean")
    for i, (text, score) in enumerate(results, 1):
        print(f"{i}. {text[:50]}... (score: {score:.4f})")
    print()

    # Example with function parameter
    print("--- Using function parameter: dot_product_similarity ---")
    results = vector_db.search_by_text(query, k=k, distance_measure=dot_product_similarity)
    for i, (text, score) in enumerate(results, 1):
        print(f"{i}. {text[:50]}... (score: {score:.4f})")
