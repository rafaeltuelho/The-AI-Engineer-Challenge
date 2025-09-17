"""
PDF processing and RAG functionality using docling and aimakerspace libraries.
"""
import os
import tempfile
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
import re

from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker
import tiktoken
from docling_core.transforms.chunker.tokenizer.openai import OpenAITokenizer

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI


class PDFProcessor:
    """Handles PDF processing using docling library."""
    
    def __init__(self):
        self.converter = DocumentConverter()
        # Initialize tokenizer and chunker for HybridChunker
        self.tokenizer = OpenAITokenizer(
            tokenizer=tiktoken.encoding_for_model("text-embedding-3-small"),
            max_tokens=8091,  # context window length required for OpenAI tokenizers
        )
        self.chunker = HybridChunker(tokenizer=self.tokenizer)
        
    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Process a PDF file and extract content as markdown with chunks.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary containing processed content and metadata
        """
        try:
            # Convert PDF to document
            result = self.converter.convert(pdf_path)
            doc = result.document
            
            # Extract text content
            text_content = doc.export_to_markdown()
            
            # Create chunks using HybridChunker
            chunks = self._create_chunks(doc)
            
            return {
                "full_text": text_content,
                "chunks": chunks,
                "chunk_count": len(chunks),
                "metadata": {
                    "file_path": pdf_path,
                    "file_name": os.path.basename(pdf_path),
                    "processing_method": "docling_hybrid_chunker"
                }
            }
            
        except Exception as e:
            raise Exception(f"Error processing PDF: {str(e)}")
    
    def _create_chunks(self, doc) -> List[str]:
        """
        Create chunks from document using docling HybridChunker.
        
        Args:
            doc: Document object from docling
            
        Returns:
            List of text chunks
        """
        try:
            # Use HybridChunker to chunk the document
            chunk_iter = self.chunker.chunk(dl_doc=doc)
            chunks = [self.chunker.contextualize(chunk=chunk) for chunk in chunk_iter]
            
            # Extract text content from chunks
            chunk_texts = []
            for chunk in chunks:
                # Get the text content from the chunk
                if hasattr(chunk, 'text'):
                    chunk_texts.append(chunk.text)
                elif hasattr(chunk, 'content'):
                    chunk_texts.append(chunk.content)
                else:
                    # Fallback: convert chunk to string
                    chunk_texts.append(str(chunk))
            
            return chunk_texts
            
        except Exception as e:
            # Fallback to simple text splitting if HybridChunker fails
            print(f"Warning: HybridChunker failed, falling back to simple chunking: {str(e)}")
            text_content = doc.export_to_markdown()
            return self._create_simple_chunks(text_content)
    
    def _create_simple_chunks(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Fallback method to create chunks from text using simple splitting approach.
        
        Args:
            text: Input text to chunk
            chunk_size: Maximum size of each chunk
            overlap: Overlap between chunks
            
        Returns:
            List of text chunks
        """
        # Split text into sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # If adding this sentence would exceed chunk size, save current chunk
            if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                # Start new chunk with overlap from previous chunk
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + " " + sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence
        
        # Add the last chunk if it's not empty
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks


class RAGSystem:
    """RAG (Retrieval-Augmented Generation) system using aimakerspace library."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.embedding_model = EmbeddingModel()
        self.vector_db = VectorDatabase(embedding_model=self.embedding_model)
        self.chat_model = ChatOpenAI(model_name="gpt-4.1-mini")
        self.documents = {}  # Store document metadata
        
    async def index_document(self, document_id: str, chunks: List[str], metadata: Dict[str, Any]) -> None:
        """
        Index document chunks in the vector database.
        
        Args:
            document_id: Unique identifier for the document
            chunks: List of text chunks to index
            metadata: Document metadata
        """
        try:
            # Get embeddings for all chunks
            embeddings = await self.embedding_model.async_get_embeddings(chunks)
            
            # Store each chunk in the vector database
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_id = f"{document_id}_chunk_{i}"
                
                # Create metadata for this chunk
                chunk_metadata = {
                    "document_id": document_id,
                    "chunk_index": i,
                    "chunk_text": chunk,
                    **metadata
                }
                
                # Insert into vector database
                self.vector_db.insert(chunk_id, embedding, chunk_metadata)
            
            # Store document metadata
            self.documents[document_id] = {
                "chunk_count": len(chunks),
                "metadata": metadata
            }
            
        except Exception as e:
            raise Exception(f"Error indexing document: {str(e)}")
    
    def search_relevant_chunks(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for relevant chunks using vector similarity.
        
        Args:
            query: Search query
            k: Number of relevant chunks to return
            
        Returns:
            List of relevant chunks with metadata
        """
        try:
            results = self.vector_db.search_with_metadata(query, k=k)
            return results
        except Exception as e:
            raise Exception(f"Error searching chunks: {str(e)}")
    
    def generate_response(self, query: str, context_chunks: List[Dict[str, Any]]) -> str:
        """
        Generate a response using the LLM with retrieved context.
        
        Args:
            query: User query
            context_chunks: Retrieved relevant chunks
            
        Returns:
            Generated response
        """
        try:
            # Prepare context from retrieved chunks
            context_text = "\n\n".join([chunk["chunk_text"] for chunk in context_chunks])
            
            # Create system message that instructs the LLM to only use provided context
            system_message = """You are a helpful assistant that answers questions based ONLY on the provided context. 
            If the answer cannot be found in the provided context, say "I cannot find the answer to your question in the provided document."
            Do not use any external knowledge or make assumptions beyond what is provided in the context."""
            
            # Create user message with context and query
            user_message = f"""Context:
{context_text}

Question: {query}

Please answer the question based only on the provided context."""
            
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            
            # Generate response
            response = self.chat_model.run(messages, text_only=True)
            return response
            
        except Exception as e:
            raise Exception(f"Error generating response: {str(e)}")
    
    def query(self, question: str, k: int = 5) -> str:
        """
        Complete RAG query: retrieve relevant chunks and generate response.
        
        Args:
            question: User question
            k: Number of relevant chunks to retrieve
            
        Returns:
            Generated response based on retrieved context
        """
        try:
            # Search for relevant chunks
            relevant_chunks = self.search_relevant_chunks(question, k=k)
            
            if not relevant_chunks:
                return "I cannot find any relevant information in the uploaded documents to answer your question."
            
            # Generate response using retrieved context
            response = self.generate_response(question, relevant_chunks)
            return response
            
        except Exception as e:
            raise Exception(f"Error processing query: {str(e)}")
    
    def get_document_info(self) -> Dict[str, Any]:
        """Get information about indexed documents."""
        return {
            "document_count": len(self.documents),
            "documents": self.documents
        }


# Global RAG systems storage (in production, use a proper database)
rag_systems: Dict[str, RAGSystem] = {}


def get_or_create_rag_system(session_id: str, api_key: str) -> RAGSystem:
    """Get or create a RAG system for a session."""
    if session_id not in rag_systems:
        rag_systems[session_id] = RAGSystem(api_key)
    return rag_systems[session_id]
