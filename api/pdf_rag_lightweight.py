"""
Lightweight PDF processing and RAG functionality using PyPDF2 and pdfplumber.
This version avoids heavy ML dependencies for Vercel deployment.
"""
import os
import tempfile
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
import re

import PyPDF2
import pdfplumber
import tiktoken

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI


class LightweightPDFProcessor:
    """Lightweight PDF processor using PyPDF2 and pdfplumber."""
    
    def __init__(self):
        # Initialize tokenizer for chunking
        self.tokenizer = tiktoken.encoding_for_model("text-embedding-3-small")
        
    def process_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Process a PDF file and extract content with chunks.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary containing processed content and metadata
        """
        try:
            # Extract text using both libraries for better coverage
            text_content = self._extract_text_hybrid(pdf_path)
            
            # Create chunks
            chunks = self._create_chunks(text_content)
            
            return {
                "full_text": text_content,
                "chunks": chunks,
                "chunk_count": len(chunks),
                "metadata": {
                    "file_path": pdf_path,
                    "file_name": os.path.basename(pdf_path),
                    "processing_method": "lightweight_hybrid"
                }
            }
            
        except Exception as e:
            raise Exception(f"Error processing PDF: {str(e)}")
    
    def _extract_text_hybrid(self, pdf_path: str) -> str:
        """Extract text using both PyPDF2 and pdfplumber for better results."""
        text_pypdf2 = self._extract_text_pypdf2(pdf_path)
        text_pdfplumber = self._extract_text_pdfplumber(pdf_path)
        
        # Use pdfplumber if it extracted more text, otherwise use PyPDF2
        if len(text_pdfplumber.strip()) > len(text_pypdf2.strip()):
            return text_pdfplumber
        else:
            return text_pypdf2
    
    def _extract_text_pypdf2(self, pdf_path: str) -> str:
        """Extract text using PyPDF2."""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            print(f"PyPDF2 extraction failed: {e}")
            return ""
    
    def _extract_text_pdfplumber(self, pdf_path: str) -> str:
        """Extract text using pdfplumber."""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text
        except Exception as e:
            print(f"pdfplumber extraction failed: {e}")
            return ""
    
    def _create_chunks(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Create text chunks using simple token-based splitting.
        
        Args:
            text: Text to chunk
            chunk_size: Maximum tokens per chunk
            overlap: Number of tokens to overlap between chunks
        """
        if not text.strip():
            return []
        
        # Tokenize the text
        tokens = self.tokenizer.encode(text)
        
        chunks = []
        start = 0
        
        while start < len(tokens):
            # Define the end of the current chunk
            end = min(start + chunk_size, len(tokens))
            
            # Extract chunk tokens
            chunk_tokens = tokens[start:end]
            
            # Decode back to text
            chunk_text = self.tokenizer.decode(chunk_tokens)
            
            # Clean up the chunk text
            chunk_text = self._clean_chunk_text(chunk_text)
            
            if chunk_text.strip():
                chunks.append(chunk_text)
            
            # Move to the next chunk with overlap
            start = end - overlap
            
            # Prevent infinite loop
            if start >= end:
                break
        
        return chunks
    
    def _clean_chunk_text(self, text: str) -> str:
        """Clean and normalize chunk text."""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove leading/trailing whitespace
        text = text.strip()
        return text


class RAGSystem:
    """RAG (Retrieval-Augmented Generation) system using aimakerspace library."""
    
    def __init__(self, api_key: str, model_name: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model_name = model_name
        self.embedding_model = EmbeddingModel(api_key=api_key)
        self.vector_db = VectorDatabase(embedding_model=self.embedding_model, api_key=api_key)
        self.chat_model = ChatOpenAI(model_name=model_name, api_key=api_key)
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
    
    def search_relevant_chunks(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """
        Search for relevant chunks based on query.
        
        Args:
            query: Search query
            k: Number of top chunks to return
        
        Returns:
            List of relevant chunks with metadata
        """
        try:
            # Get query embedding
            query_embedding = self.embedding_model.get_embedding(query)
            
            # Search vector database
            results = self.vector_db.search(query_embedding, k=k)
            
            return results
            
        except Exception as e:
            raise Exception(f"Error searching chunks: {str(e)}")
    
    async def query_documents(self, query: str, k: int = 3) -> str:
        """
        Query documents using RAG approach.
        
        Args:
            query: User query
            k: Number of chunks to retrieve
        
        Returns:
            Generated response based on retrieved chunks
        """
        try:
            # Search for relevant chunks
            relevant_chunks = self.search_relevant_chunks(query, k=k)
            
            if not relevant_chunks:
                return "I couldn't find any relevant information in the uploaded documents to answer your question."
            
            # Prepare context from chunks
            context_parts = []
            for chunk_data in relevant_chunks:
                chunk_text = chunk_data.get('chunk_text', '')
                if chunk_text:
                    context_parts.append(chunk_text)
            
            context = "\n\n".join(context_parts)
            
            # Create RAG prompt
            rag_prompt = f"""Based on the following context from the uploaded documents, please answer the user's question. If the context doesn't contain enough information to answer the question, please say so.

Context:
{context}

Question: {query}

Answer:"""
            
            # Generate response
            response = await self.chat_model.arun(rag_prompt)
            return response
            
        except Exception as e:
            raise Exception(f"Error querying documents: {str(e)}")


# Global RAG systems storage
rag_systems = {}

def get_or_create_rag_system(session_id: str, api_key: str, model_name: str = "gpt-4o-mini") -> RAGSystem:
    """Get existing or create new RAG system for session."""
    if session_id not in rag_systems:
        rag_systems[session_id] = RAGSystem(api_key=api_key, model_name=model_name)
    return rag_systems[session_id]
