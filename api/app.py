# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel, field_validator
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
# Import slowapi for rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
import uuid
import re
import hashlib
import asyncio
import threading
import time
import tempfile
from pathlib import Path

# Import our PDF RAG functionality
from pdf_rag import PDFProcessor, get_or_create_rag_system

# Initialize FastAPI application with comprehensive OpenAPI configuration
app = FastAPI(
    title="OpenAI Chat API",
    description="""
    A comprehensive FastAPI-based backend service that provides:
    
    * **Streaming Chat Interface**: Real-time chat with OpenAI's GPT models
    * **Session Management**: Secure session-based authentication
    * **Conversation History**: Persistent conversation storage and retrieval
    * **PDF RAG System**: Upload and query PDF documents using Retrieval-Augmented Generation
    * **Rate Limiting**: Built-in protection against abuse
    * **Security**: Input validation and secure API key handling
    
    ## Features
    
    - 🔄 **Real-time Streaming**: Get responses as they're generated
    - 💬 **Conversation Management**: Create, retrieve, and delete conversations
    - 📄 **PDF Processing**: Upload and query PDF documents
    - 🔍 **RAG Queries**: Ask questions about uploaded documents
    - 🛡️ **Security**: Rate limiting, input validation, and secure session management
    - 📚 **Interactive Docs**: Test the API directly from the browser
    
    ## Authentication
    
    This API uses session-based authentication. First, create a session with your OpenAI API key, then use the returned session ID in subsequent requests.
    """,
    version="1.0.0",
    contact={
        "name": "API Support",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    servers=[
        {
            "url": "http://localhost:8000",
            "description": "Development server"
        },
        {
            "url": "https://your-production-domain.com",
            "description": "Production server"
        }
    ],
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "Session management and authentication endpoints"
        },
        {
            "name": "Chat",
            "description": "Chat and conversation management endpoints"
        },
        {
            "name": "PDF RAG",
            "description": "PDF upload and RAG query endpoints"
        },
        {
            "name": "Health",
            "description": "Health check and system status endpoints"
        }
    ]
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# In-memory storage for conversations (in production, use a proper database)
# Structure: {hashed_api_key: {conversation_id: conversation_data}}
conversations: Dict[str, Dict[str, Dict[str, Any]]] = {}

# Session management
# Structure: {session_id: {"api_key": hashed_api_key, "last_access": datetime}}
sessions: Dict[str, Dict[str, Any]] = {}

# Track last access time for cleanup mechanism
# Structure: {hashed_api_key: last_access_time}
api_key_last_access: Dict[str, datetime] = {}

def hash_api_key(api_key: str) -> str:
    """Hash the API key using SHA-256 for secure storage key generation"""
    return hashlib.sha256(api_key.encode('utf-8')).hexdigest()

def create_session(api_key: str) -> str:
    """Create a new session for the given API key"""
    session_id = str(uuid.uuid4())
    hashed_api_key = hash_api_key(api_key)
    
    sessions[session_id] = {
        "api_key": hashed_api_key,
        "last_access": datetime.now(timezone.utc)
    }
    
    # Update API key access time
    update_api_key_access(hashed_api_key)
    
    return session_id

def get_session_api_key(session_id: str) -> Optional[str]:
    """Get the hashed API key for a session, return None if session doesn't exist"""
    if session_id not in sessions:
        return None
    
    # Update session access time
    sessions[session_id]["last_access"] = datetime.now(timezone.utc)
    hashed_api_key = sessions[session_id]["api_key"]
    update_api_key_access(hashed_api_key)
    
    return hashed_api_key

def get_user_conversations(hashed_api_key: str) -> Dict[str, Dict[str, Any]]:
    """Get conversations for a specific user (hashed API key)"""
    if hashed_api_key not in conversations:
        conversations[hashed_api_key] = {}
    return conversations[hashed_api_key]

def update_api_key_access(hashed_api_key: str):
    """Update the last access time for an API key"""
    api_key_last_access[hashed_api_key] = datetime.now(timezone.utc)

def cleanup_inactive_conversations():
    """Clean up conversations and sessions for API keys that haven't been used in the last 10 minutes"""
    current_time = datetime.now(timezone.utc)
    inactive_keys = []
    inactive_sessions = []
    
    # Clean up inactive API keys
    for hashed_key, last_access in api_key_last_access.items():
        if current_time - last_access > timedelta(minutes=10):
            inactive_keys.append(hashed_key)
    
    # Clean up inactive sessions
    for session_id, session_data in sessions.items():
        if current_time - session_data["last_access"] > timedelta(minutes=10):
            inactive_sessions.append(session_id)
    
    # Remove inactive conversations and API key access records
    for hashed_key in inactive_keys:
        if hashed_key in conversations:
            del conversations[hashed_key]
        if hashed_key in api_key_last_access:
            del api_key_last_access[hashed_key]
        print(f"Cleaned up conversations for inactive API key: {hashed_key[:8]}...")
    
    # Remove inactive sessions
    for session_id in inactive_sessions:
        del sessions[session_id]
        print(f"Cleaned up inactive session: {session_id[:8]}...")

def start_cleanup_scheduler():
    """Start the background cleanup scheduler"""
    def cleanup_loop():
        while True:
            try:
                cleanup_inactive_conversations()
                time.sleep(60)  # Run cleanup every minute
            except Exception as e:
                print(f"Error in cleanup scheduler: {e}")
                time.sleep(60)
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    print("Started conversation cleanup scheduler")

# Start the cleanup scheduler when the module loads
start_cleanup_scheduler()

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None  # ID to continue existing conversation
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication
    
    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v):
        """Validate OpenAI API key format"""
        if not v or not isinstance(v, str):
            raise ValueError('API key is required')
        
        # Temporarily disable strict validation for debugging
        # Just check that it's not empty and is a string
        if len(v.strip()) == 0:
            raise ValueError('API key cannot be empty')
        
        return v
    
    @field_validator('user_message')
    @classmethod
    def validate_user_message(cls, v):
        """Validate user message content"""
        if not v or not isinstance(v, str):
            raise ValueError('User message is required')
        
        if len(v.strip()) == 0:
            raise ValueError('User message cannot be empty')
        
        if len(v) > 10000:  # Reasonable limit for message length
            raise ValueError('User message is too long (max 10,000 characters)')
        
        return v.strip()
    
    @field_validator('developer_message')
    @classmethod
    def validate_developer_message(cls, v):
        """Validate developer/system message content"""
        if not v or not isinstance(v, str):
            raise ValueError('Developer message is required')
        
        if len(v) > 5000:  # Reasonable limit for system message
            raise ValueError('Developer message is too long (max 5,000 characters)')
        
        return v.strip()
    
    @field_validator('model')
    @classmethod
    def validate_model(cls, v):
        """Validate model selection"""
        if not v:
            return "gpt-4.1-mini"  # Default model
        
        # List of allowed models (you can expand this list)
        allowed_models = [
            "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
            "gpt-4.1-mini", "gpt-4.1-nano", "gpt-5", "gpt-4-mini", "gpt-5-nano"
        ]
        
        if v not in allowed_models:
            raise ValueError(f'Invalid model: {v}. Allowed models: {", ".join(allowed_models)}')
        
        return v
    
    @field_validator('conversation_id')
    @classmethod
    def validate_conversation_id(cls, v):
        """Validate conversation ID format"""
        if v is None:
            return v
        
        if not isinstance(v, str):
            raise ValueError('Conversation ID must be a string')
        
        if len(v) > 100:
            raise ValueError('Conversation ID is too long')
        
        # Allow alphanumeric, hyphens, and underscores
        if not re.match(r'^[A-Za-z0-9_-]+$', v):
            raise ValueError('Conversation ID contains invalid characters')
        
        return v

class Message(BaseModel):
    role: str  # "system", "user", or "assistant"
    content: str
    timestamp: datetime

class ConversationResponse(BaseModel):
    conversation_id: str
    message: str
    timestamp: datetime

class SessionRequest(BaseModel):
    api_key: str
    
    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v):
        """Validate OpenAI API key format"""
        if not v or not isinstance(v, str):
            raise ValueError('API key is required')
        
        if len(v.strip()) == 0:
            raise ValueError('API key cannot be empty')
        
        return v

class SessionResponse(BaseModel):
    session_id: str
    message: str

class PDFUploadResponse(BaseModel):
    document_id: str
    message: str
    chunk_count: int
    file_name: str

class RAGQueryRequest(BaseModel):
    question: str
    k: Optional[int] = 5  # Number of relevant chunks to retrieve
    model: Optional[str] = "gpt-4.1-mini"  # Model selection for RAG queries
    
    @field_validator('question')
    @classmethod
    def validate_question(cls, v):
        """Validate question content"""
        if not v or not isinstance(v, str):
            raise ValueError('Question is required')
        
        if len(v.strip()) == 0:
            raise ValueError('Question cannot be empty')
        
        if len(v) > 2000:  # Reasonable limit for question length
            raise ValueError('Question is too long (max 2,000 characters)')
        
        return v.strip()
    
    @field_validator('k')
    @classmethod
    def validate_k(cls, v):
        """Validate k parameter"""
        if v is None:
            return 5
        
        if not isinstance(v, int):
            raise ValueError('k must be an integer')
        
        if v < 1 or v > 20:
            raise ValueError('k must be between 1 and 20')
        
        return v
    
    @field_validator('model')
    @classmethod
    def validate_model(cls, v):
        """Validate model selection"""
        if not v:
            return "gpt-4.1-mini"  # Default model
        
        # List of allowed models (you can expand this list)
        allowed_models = [
            "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
            "gpt-4.1-mini", "gpt-4.1-nano", "gpt-5", "gpt-4-mini", "gpt-5-nano"
        ]
        
        if v not in allowed_models:
            raise ValueError(f'Invalid model: {v}. Allowed models: {", ".join(allowed_models)}')
        
        return v

class RAGQueryResponse(BaseModel):
    answer: str
    relevant_chunks_count: int
    document_info: Dict[str, Any]

# Endpoint to create a new session
@app.post(
    "/api/session",
    response_model=SessionResponse,
    tags=["Authentication"],
    summary="Create a new session",
    description="Create a new authenticated session using your OpenAI API key. Returns a session ID that you'll use for subsequent requests.",
    responses={
        200: {"description": "Session created successfully"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("5/minute")  # Limit to 5 session creations per minute per IP
async def create_session_endpoint(request: Request, session_request: SessionRequest):
    try:
        session_id = create_session(session_request.api_key)
        return SessionResponse(
            session_id=session_id,
            message="Session created successfully"
        )
    except Exception as e:
        print(f"Error creating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Define the main chat endpoint that handles POST requests
@app.post(
    "/api/chat",
    tags=["Chat"],
    summary="Send a chat message",
    description="Send a message to the AI and receive a streaming response. Supports conversation history and model selection.",
    responses={
        200: {"description": "Streaming chat response"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("10/minute")  # Limit to 10 requests per minute per IP
async def chat(request: Request, chat_request: ChatRequest):
    try:
        # Get session ID from headers
        session_id = request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=401, detail="Session ID required")
        
        # Get hashed API key from session
        hashed_api_key = get_session_api_key(session_id)
        if not hashed_api_key:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        # Debug logging
        print(f"Received chat request: session_id={session_id[:8]}..., hashed_api_key={hashed_api_key[:8]}..., model={chat_request.model}, user_message_length={len(chat_request.user_message)}")
        
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=chat_request.api_key)
        
        # Get user-specific conversations
        user_conversations = get_user_conversations(hashed_api_key)
        
        # Generate or retrieve conversation ID
        conversation_id = chat_request.conversation_id or str(uuid.uuid4())
        
        # Initialize conversation if it doesn't exist
        if conversation_id not in user_conversations:
            user_conversations[conversation_id] = {
                "messages": [],
                "system_message": chat_request.developer_message,
                "title": None,  # Will be set when first user message is added
                "created_at": datetime.now(timezone.utc),
                "last_updated": datetime.now(timezone.utc),
                "mode": "regular"  # Default to regular chat mode
            }
        
        # Add user message to conversation history
        user_message = Message(
            role="user",
            content=chat_request.user_message,
            timestamp=datetime.now(timezone.utc)
        )
        user_conversations[conversation_id]["messages"].append(user_message)
        user_conversations[conversation_id]["last_updated"] = datetime.now(timezone.utc)
        
        # Set conversation title from first user message if not already set
        if user_conversations[conversation_id]["title"] is None:
            # Use first line of the user message as title (max 50 characters)
            first_line = chat_request.user_message.split('\n')[0].strip()
            user_conversations[conversation_id]["title"] = first_line[:50] + ("..." if len(first_line) > 50 else "")
        
        # Build the full conversation context for OpenAI
        messages_for_openai = [
            {"role": "system", "content": user_conversations[conversation_id]["system_message"]}
        ]
        
        # Add conversation history (limit to last 20 messages to avoid token limits)
        recent_messages = user_conversations[conversation_id]["messages"][-20:]
        for msg in recent_messages:
            # Map our roles to OpenAI's expected roles
            # By using alternating user and assistant messages, 
            # you capture the previous state of a conversation in one request to the model.
            openai_role = "assistant" if msg.role == "assistant" else msg.role
            messages_for_openai.append({
                "role": openai_role,
                "content": msg.content
            })
        
        # Create an async generator function for streaming responses
        async def generate():
            try:
                # Create a streaming chat completion request
                stream = client.chat.completions.create(
                    model=chat_request.model,
                    messages=messages_for_openai,
                    stream=True  # Enable streaming response
                )
                
                # Collect the full response for storage
                full_response = ""
                
                # Yield each chunk of the response as it becomes available
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        yield content
                
                # Store the assistant's response in conversation history
                assistant_message = Message(
                    role="assistant",
                    content=full_response,
                    timestamp=datetime.now(timezone.utc)
                )
                user_conversations[conversation_id]["messages"].append(assistant_message)
                user_conversations[conversation_id]["last_updated"] = datetime.now(timezone.utc)
                
            except Exception as e:
                # Remove the user message if the API call failed
                if user_conversations[conversation_id]["messages"]:
                    user_conversations[conversation_id]["messages"].pop()
                raise e

        # Return a streaming response to the client with conversation ID in headers
        response = StreamingResponse(generate(), media_type="text/plain")
        response.headers["X-Conversation-ID"] = conversation_id
        return response
    
    except Exception as e:
        # Handle any errors that occur during processing
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to get conversation history
@app.get(
    "/api/conversations/{conversation_id}",
    tags=["Chat"],
    summary="Get conversation history",
    description="Retrieve the complete history of a specific conversation including all messages and metadata.",
    responses={
        200: {"description": "Conversation history retrieved successfully"},
        401: {"description": "Invalid or expired session"},
        404: {"description": "Conversation not found"},
        429: {"description": "Rate limit exceeded"}
    }
)
@limiter.limit("30/minute")  # Limit to 30 requests per minute per IP
async def get_conversation(request: Request, conversation_id: str):
    # Get session ID from headers
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    
    # Get hashed API key from session
    hashed_api_key = get_session_api_key(session_id)
    if not hashed_api_key:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get user-specific conversations
    user_conversations = get_user_conversations(hashed_api_key)
    
    if conversation_id not in user_conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "conversation_id": conversation_id,
        "title": user_conversations[conversation_id].get("title", "New Conversation"),
        "system_message": user_conversations[conversation_id]["system_message"],
        "messages": user_conversations[conversation_id]["messages"],
        "created_at": user_conversations[conversation_id]["created_at"],
        "last_updated": user_conversations[conversation_id]["last_updated"],
        "mode": user_conversations[conversation_id].get("mode", "regular")
    }

# Endpoint to list all conversations
@app.get(
    "/api/conversations",
    tags=["Chat"],
    summary="List all conversations",
    description="Get a list of all conversations for the authenticated user, sorted by last updated time.",
    responses={
        200: {"description": "List of conversations retrieved successfully"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"}
    }
)
@limiter.limit("20/minute")  # Limit to 20 requests per minute per IP
async def list_conversations(request: Request):
    # Get session ID from headers
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    
    # Get hashed API key from session
    hashed_api_key = get_session_api_key(session_id)
    if not hashed_api_key:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get user-specific conversations
    user_conversations = get_user_conversations(hashed_api_key)
    
    conversation_list = []
    for conv_id, conv_data in user_conversations.items():
        conversation_list.append({
            "conversation_id": conv_id,
            "title": conv_data.get("title", "New Conversation"),
            "system_message": conv_data["system_message"],
            "message_count": len(conv_data["messages"]),
            "created_at": conv_data["created_at"],
            "last_updated": conv_data["last_updated"],
            "mode": conv_data.get("mode", "regular")
        })
    
    # Sort by last updated (most recent first)
    conversation_list.sort(key=lambda x: x["last_updated"], reverse=True)
    return conversation_list

# Endpoint to delete a conversation
@app.delete(
    "/api/conversations/{conversation_id}",
    tags=["Chat"],
    summary="Delete a conversation",
    description="Permanently delete a specific conversation and all its messages.",
    responses={
        200: {"description": "Conversation deleted successfully"},
        401: {"description": "Invalid or expired session"},
        404: {"description": "Conversation not found"},
        429: {"description": "Rate limit exceeded"}
    }
)
@limiter.limit("10/minute")  # Limit to 10 requests per minute per IP
async def delete_conversation(request: Request, conversation_id: str):
    # Get session ID from headers
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    
    # Get hashed API key from session
    hashed_api_key = get_session_api_key(session_id)
    if not hashed_api_key:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get user-specific conversations
    user_conversations = get_user_conversations(hashed_api_key)
    
    if conversation_id not in user_conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    del user_conversations[conversation_id]
    return {"message": "Conversation deleted successfully"}

# Endpoint to clear all conversations for a specific user
@app.delete(
    "/api/conversations",
    tags=["Chat"],
    summary="Clear all conversations",
    description="Permanently delete all conversations for the authenticated user. This action cannot be undone.",
    responses={
        200: {"description": "All conversations cleared successfully"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"}
    }
)
@limiter.limit("5/minute")  # Limit to 5 requests per minute per IP (more restrictive)
async def clear_all_conversations(request: Request):
    # Get session ID from headers
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    
    # Get hashed API key from session
    hashed_api_key = get_session_api_key(session_id)
    if not hashed_api_key:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get user-specific conversations and clear them
    user_conversations = get_user_conversations(hashed_api_key)
    user_conversations.clear()
    
    return {"message": "All conversations cleared successfully"}

# PDF Upload endpoint
@app.post(
    "/api/upload-pdf",
    response_model=PDFUploadResponse,
    tags=["PDF RAG"],
    summary="Upload a PDF document",
    description="Upload and process a PDF document for RAG (Retrieval-Augmented Generation) functionality. The document will be chunked and indexed for later querying.",
    responses={
        200: {"description": "PDF processed and indexed successfully"},
        400: {"description": "Invalid file type or size"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("3/minute")  # Limit to 3 PDF uploads per minute per IP
async def upload_pdf(
    request: Request,
    file: UploadFile = File(..., description="PDF file to upload (max 10MB)")
):
    """Upload and process a PDF file for RAG functionality."""
    try:
        # Get session ID from headers
        session_id = request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=401, detail="Session ID required")
        
        # Get hashed API key from session
        hashed_api_key = get_session_api_key(session_id)
        if not hashed_api_key:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        # Get API key from request headers
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            raise HTTPException(status_code=401, detail="API key required in X-API-Key header")
        
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Validate file size (max 10MB)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="File size too large (max 10MB)")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        try:
            # Process PDF using docling
            pdf_processor = PDFProcessor()
            processed_data = pdf_processor.process_pdf(temp_file_path)
            
            # Generate document ID
            document_id = str(uuid.uuid4())
            
            # Get or create RAG system for this session
            rag_system = get_or_create_rag_system(session_id, api_key)
            
            # Index the document
            await rag_system.index_document(
                document_id=document_id,
                chunks=processed_data["chunks"],
                metadata=processed_data["metadata"]
            )
            
            return PDFUploadResponse(
                document_id=document_id,
                message="PDF processed and indexed successfully",
                chunk_count=processed_data["chunk_count"],
                file_name=processed_data["metadata"]["file_name"]
            )
            
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
    
    except Exception as e:
        print(f"Error in PDF upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# RAG Query endpoint
@app.post(
    "/api/rag-query",
    response_model=RAGQueryResponse,
    tags=["PDF RAG"],
    summary="Query uploaded documents",
    description="Ask questions about uploaded PDF documents using RAG (Retrieval-Augmented Generation). Returns relevant answers based on document content.",
    responses={
        200: {"description": "RAG query processed successfully"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("20/minute")  # Limit to 20 RAG queries per minute per IP
async def rag_query(request: Request, query_request: RAGQueryRequest):
    """Query the RAG system with a question."""
    try:
        # Get session ID from headers
        session_id = request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=401, detail="Session ID required")
        
        # Get hashed API key from session
        hashed_api_key = get_session_api_key(session_id)
        if not hashed_api_key:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        # Get API key from request headers (we need it for the RAG system)
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            raise HTTPException(status_code=401, detail="API key required in X-API-Key header")
        
        # Get RAG system for this session with the specified model
        rag_system = get_or_create_rag_system(session_id, api_key, query_request.model)
        
        # Query the RAG system
        answer = rag_system.query(query_request.question, k=query_request.k)
        
        # Get document info
        doc_info = rag_system.get_document_info()
        
        # Get relevant chunks count (approximate)
        relevant_chunks = rag_system.search_relevant_chunks(query_request.question, k=query_request.k)
        relevant_chunks_count = len(relevant_chunks)
        
        # Store the RAG conversation in conversation history
        user_conversations = get_user_conversations(hashed_api_key)
        
        # Generate or retrieve conversation ID from request headers
        conversation_id = request.headers.get("X-Conversation-ID") or str(uuid.uuid4())
        
        # Initialize conversation if it doesn't exist
        if conversation_id not in user_conversations:
            user_conversations[conversation_id] = {
                "messages": [],
                "system_message": "You are a helpful AI assistant with access to uploaded documents. Use the document content to answer questions accurately.",
                "title": None,  # Will be set when first user message is added
                "created_at": datetime.now(timezone.utc),
                "last_updated": datetime.now(timezone.utc),
                "mode": "rag"  # RAG mode for document queries
            }
        
        # Add user message to conversation history
        user_message = Message(
            role="user",
            content=query_request.question,
            timestamp=datetime.now(timezone.utc)
        )
        user_conversations[conversation_id]["messages"].append(user_message)
        user_conversations[conversation_id]["last_updated"] = datetime.now(timezone.utc)
        
        # Set conversation title from first user message if not already set
        if user_conversations[conversation_id]["title"] is None:
            # Use first line of the user message as title (max 50 characters)
            first_line = query_request.question.split('\n')[0].strip()
            user_conversations[conversation_id]["title"] = first_line[:50] + ("..." if len(first_line) > 50 else "")
        
        # Add assistant message to conversation history
        assistant_message = Message(
            role="assistant",
            content=answer,
            timestamp=datetime.now(timezone.utc)
        )
        user_conversations[conversation_id]["messages"].append(assistant_message)
        user_conversations[conversation_id]["last_updated"] = datetime.now(timezone.utc)
        
        # Create response with conversation ID in headers
        response = RAGQueryResponse(
            answer=answer,
            relevant_chunks_count=relevant_chunks_count,
            document_info=doc_info
        )
        
        # Return response with conversation ID in headers
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=response.dict(),
            headers={"X-Conversation-ID": conversation_id}
        )
    
    except Exception as e:
        print(f"Error in RAG query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get document info endpoint
@app.get(
    "/api/documents",
    tags=["PDF RAG"],
    summary="Get uploaded documents info",
    description="Retrieve information about all uploaded documents for the current session, including metadata and chunk counts.",
    responses={
        200: {"description": "Document information retrieved successfully"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("10/minute")  # Limit to 10 requests per minute per IP
async def get_documents(request: Request):
    """Get information about uploaded documents for the session."""
    try:
        # Get session ID from headers
        session_id = request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=401, detail="Session ID required")
        
        # Get hashed API key from session
        hashed_api_key = get_session_api_key(session_id)
        if not hashed_api_key:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        # Get API key from request headers
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            raise HTTPException(status_code=401, detail="API key required in X-API-Key header")
        
        # Get RAG system for this session (using default model for document info)
        rag_system = get_or_create_rag_system(session_id, api_key)
        
        # Get document info
        doc_info = rag_system.get_document_info()
        
        return doc_info
    
    except Exception as e:
        print(f"Error getting documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get(
    "/api/health",
    tags=["Health"],
    summary="Health check",
    description="Check the API health status. Returns OK if the service is running properly.",
    responses={
        200: {"description": "API is healthy and running"}
    }
)
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
