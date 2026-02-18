# Import required FastAPI components for building the API
import hashlib
import os
import re
# Add current directory to Python path for Vercel deployment
import sys
import tempfile
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import (FastAPI, File, Header, HTTPException, Request,
                     UploadFile)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
# Import Pydantic for data validation and settings management
from pydantic import BaseModel, field_validator
# Import slowapi for rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
# Import Google OAuth libraries
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import tiktoken
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# ============================================
# Configurable Timeout Settings
# ============================================
# Session timeout: How long before an inactive session is cleaned up (in minutes)
SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", "60"))
# Cleanup interval: How often the cleanup scheduler runs (in seconds)
CLEANUP_INTERVAL_SECONDS = int(os.getenv("CLEANUP_INTERVAL_SECONDS", "60"))

# ============================================
# Google OAuth Configuration
# ============================================
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
WHITELISTED_EMAILS = set(
    email.strip().lower()
    for email in os.getenv("WHITELISTED_EMAILS", "").split(",")
    if email.strip()
)

# ============================================
# Free Tier Configuration
# ============================================
MAX_FREE_TURNS = int(os.getenv("MAX_FREE_TURNS", "3"))
MAX_FREE_MESSAGE_TOKENS = int(os.getenv("MAX_FREE_MESSAGE_TOKENS", "500"))
FREE_PROVIDER = os.getenv("FREE_PROVIDER", "together")
FREE_MODEL = os.getenv("FREE_MODEL", "deepseek-ai/DeepSeek-V3.1")

# Server-side API keys (for free tier)
SERVER_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SERVER_TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")

# Try to import RAG functionality (optional for Vercel free tier)
RAG_ENABLED = False
DocumentProcessor = None
get_or_create_rag_system = None
ChatOpenAI = None

try:
    from rag_lightweight import DocumentProcessor, get_or_create_rag_system
    from aimakerspace.openai_utils.chatmodel import ChatOpenAI
    RAG_ENABLED = True
except ImportError:
    # RAG dependencies not available - this is OK for basic chat functionality
    pass

# Initialize FastAPI application with comprehensive OpenAPI configuration
app = FastAPI(
    title="OpenAI Chat API (Lightweight)",
    description="""
    A lightweight FastAPI-based backend service optimized for Vercel deployment:
    
    * **Streaming Chat Interface**: Real-time chat with OpenAI's GPT models
    * **Session Management**: Secure session-based authentication
    * **Conversation History**: Persistent conversation storage and retrieval
    * **Multi-format Document RAG**: Upload and query documents (PDF, Word, PowerPoint) using simple text extraction
    * **Rate Limiting**: Built-in protection against abuse
    * **Security**: Input validation and secure API key handling
    
    ## Features
    
    - 🔄 **Real-time Streaming**: Get responses as they're generated
    - 💬 **Conversation Management**: Create, retrieve, and delete conversations
    - 📄 **Document Processing**: Upload and query documents (PDF, Word, PowerPoint) with lightweight extraction
    - 🔍 **RAG Queries**: Ask questions about uploaded documents
    - 🛡️ **Security**: Rate limiting, input validation, and secure session management
    - 📚 **Interactive Docs**: Test the API directly from the browser
    
    ## Optimization Notes
    
    This version uses lightweight dependencies (PyPDF2, pdfplumber) instead of heavy ML libraries
    to work within Vercel's free tier memory constraints.
    
    ## Authentication
    
    This API uses session-based authentication. First, create a session with your OpenAI API key, then use the returned session ID in subsequent requests.
    """,
    version="1.0.0-lightweight",
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
    expose_headers=["X-Conversation-ID", "X-Free-Turns-Remaining"],  # Expose custom headers to frontend
)

# In-memory storage for conversations (in production, use a proper database)
# Structure: {session_id: {conversation_id: conversation_data}}
conversations: Dict[str, Dict[str, Dict[str, Any]]] = {}

# Session management
# Structure: {session_id: {
#   "auth_type": "api_key" | "google" | "guest",
#   "email": Optional[str],
#   "name": Optional[str],
#   "picture": Optional[str],
#   "is_whitelisted": bool,
#   "free_turns_used": int,
#   "has_own_api_key": bool,
#   "api_key": Optional[str],  # Only for api_key auth_type
#   "provider": str,
#   "last_access": datetime
# }}
sessions: Dict[str, Dict[str, Any]] = {}

def create_session(
    auth_type: str = "api_key",
    api_key: Optional[str] = None,
    provider: str = "openai",
    email: Optional[str] = None,
    name: Optional[str] = None,
    picture: Optional[str] = None
) -> str:
    """Create a new session with the specified authentication type and user info.

    Args:
        auth_type: Type of authentication ("api_key", "google", or "guest")
        api_key: API key for api_key auth type (optional)
        provider: Provider for API calls (default: "openai")
        email: User email (for Google auth)
        name: User name (for Google auth)
        picture: User profile picture URL (for Google auth)

    Returns:
        session_id: Unique session identifier
    """
    session_id = str(uuid.uuid4())

    # Determine if user is whitelisted
    is_whitelisted = False
    if email and WHITELISTED_EMAILS:
        is_whitelisted = email.lower() in WHITELISTED_EMAILS

    sessions[session_id] = {
        "auth_type": auth_type,
        "email": email,
        "name": name,
        "picture": picture,
        "is_whitelisted": is_whitelisted,
        "free_turns_used": 0,
        "has_own_api_key": api_key is not None,
        "api_key": api_key,
        "provider": provider,
        "last_access": datetime.now(timezone.utc)
    }

    return session_id

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session data for a session, return None if session doesn't exist"""
    if session_id not in sessions:
        return None

    # Update session access time
    sessions[session_id]["last_access"] = datetime.now(timezone.utc)
    return sessions[session_id]

def count_tokens(text: str, model: str = "gpt-4") -> int:
    """Count the number of tokens in a text string.

    Args:
        text: The text to count tokens for
        model: The model to use for tokenization (default: "gpt-4")

    Returns:
        Number of tokens in the text
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        # Fallback to approximate token count if encoding fails
        return len(text) // 4

def resolve_api_key(session_id: str, user_api_key: Optional[str] = None, provider: Optional[str] = None) -> tuple[str, str]:
    """Resolve which API key to use based on session and user input.

    Priority:
    1. User-provided API key (if given)
    2. Session's stored API key (if has_own_api_key is True)
    3. Server-side API key for free tier

    Args:
        session_id: The session ID
        user_api_key: Optional API key provided by the user
        provider: Optional provider override

    Returns:
        Tuple of (api_key, provider)

    Raises:
        HTTPException: If no API key is available
    """
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    # Determine provider
    resolved_provider = provider or session.get("provider", "openai")

    # Priority 1: User-provided API key
    if user_api_key:
        return user_api_key, resolved_provider

    # Priority 2: Session's stored API key
    if session.get("has_own_api_key") and session.get("api_key"):
        return session["api_key"], resolved_provider

    # Priority 3: Server-side API key for free tier
    # Check if user has exceeded free turns
    if session["free_turns_used"] >= MAX_FREE_TURNS and not session.get("is_whitelisted"):
        raise HTTPException(
            status_code=403,
            detail=f"Free tier limit reached ({MAX_FREE_TURNS} turns). Please provide your own API key or sign in with a whitelisted account."
        )

    # Use server-side API key based on provider
    if resolved_provider == "together":
        if not SERVER_TOGETHER_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Server-side Together.ai API key not configured. Please provide your own API key."
            )
        return SERVER_TOGETHER_API_KEY, resolved_provider
    else:
        if not SERVER_OPENAI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Server-side OpenAI API key not configured. Please provide your own API key."
            )
        return SERVER_OPENAI_API_KEY, resolved_provider

def get_session_conversations(session_id: str) -> Dict[str, Dict[str, Any]]:
    """Get conversations scoped to a specific session."""
    if session_id not in conversations:
        conversations[session_id] = {}
    return conversations[session_id]

def cleanup_inactive_conversations():
    """Clean up conversations and sessions that have been inactive.

    Timeout is configurable via SESSION_TIMEOUT_MINUTES env var (default: 60).
    """
    current_time = datetime.now(timezone.utc)
    inactive_sessions = []
    # Identify inactive sessions based on configurable timeout
    for session_id, session_data in sessions.items():
        if current_time - session_data["last_access"] > timedelta(minutes=SESSION_TIMEOUT_MINUTES):
            inactive_sessions.append(session_id)
    # Remove conversations and sessions for inactive session_ids
    for session_id in inactive_sessions:
        if session_id in conversations:
            del conversations[session_id]
        del sessions[session_id]
        print(f"Cleaned up inactive session and its conversations: {session_id[:8]}...")

def start_cleanup_scheduler():
    """Start the background cleanup scheduler.

    Interval is configurable via CLEANUP_INTERVAL_SECONDS env var (default: 60).
    """
    def cleanup_loop():
        while True:
            try:
                cleanup_inactive_conversations()
                time.sleep(CLEANUP_INTERVAL_SECONDS)
            except Exception as e:
                print(f"Error in cleanup scheduler: {e}")
                time.sleep(CLEANUP_INTERVAL_SECONDS)

    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    print(f"Started conversation cleanup scheduler (session timeout: {SESSION_TIMEOUT_MINUTES}min, interval: {CLEANUP_INTERVAL_SECONDS}s)")

# Start the cleanup scheduler when the module loads
start_cleanup_scheduler()

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None  # ID to continue existing conversation
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: Optional[str] = None  # API key for authentication (optional, can use session's key or server key)
    provider: Optional[str] = "openai"  # Provider selection: "openai" or "together"

    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v):
        """Validate API key format if provided"""
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError('API key must be a string')

        # Treat empty/whitespace-only strings as "no key provided"
        # This happens when whitelisted/free-tier users don't have their own key
        if len(v.strip()) == 0:
            return None

        return v
    
    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v):
        """Validate provider selection"""
        if not v:
            return "openai"  # Default provider
        
        allowed_providers = ["openai", "together"]
        if v.lower() not in allowed_providers:
            raise ValueError(f'Invalid provider: {v}. Allowed providers: {", ".join(allowed_providers)}')
        
        return v.lower()
    
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
        
        # List of allowed models for OpenAI
        openai_models = [
            "gpt-4", "gpt-4-mini", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
            "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-5", "gpt-5-mini", "gpt-5-nano"
        ]
        
        # List of allowed models for Together.ai
        together_models = [
            "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-V3.1", "deepseek-ai/DeepSeek-V3",
            "meta-llama/Llama-3.3-70B-Instruct-Turbo", 
            "openai/gpt-oss-20b", "openai/gpt-oss-120b", "moonshotai/Kimi-K2-Instruct-0905",
            "Qwen/Qwen3-Next-80B-A3B-Thinking"
        ]
        
        all_models = openai_models + together_models
        
        if v not in all_models:
            raise ValueError(f'Invalid model: {v}. Allowed models: {", ".join(all_models)}')
        
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
    api_key: Optional[str] = None  # API key is now optional
    provider: Optional[str] = "openai"  # Provider selection: "openai" or "together"

    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v):
        """Validate API key format if provided"""
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError('API key must be a string')

        # Treat empty/whitespace-only strings as "no key provided"
        # This happens when whitelisted/free-tier users don't have their own key
        if len(v.strip()) == 0:
            return None

        return v

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v):
        """Validate provider selection"""
        if not v:
            return "openai"  # Default provider

        allowed_providers = ["openai", "together"]
        if v.lower() not in allowed_providers:
            raise ValueError(f'Invalid provider: {v}. Allowed providers: {", ".join(allowed_providers)}')

        return v.lower()

class SessionResponse(BaseModel):
    session_id: str
    message: str

class AuthLoginResponse(BaseModel):
    session_id: str
    message: str
    user: dict  # Contains auth_type, email, name, picture, is_whitelisted, free_turns_remaining, has_own_api_key

class GoogleAuthRequest(BaseModel):
    credential: str  # Google credential from frontend

    @field_validator('credential')
    @classmethod
    def validate_credential(cls, v):
        """Validate credential format"""
        if not v or not isinstance(v, str):
            raise ValueError('Credential is required')

        if len(v.strip()) == 0:
            raise ValueError('Credential cannot be empty')

        return v.strip()

class AuthMeResponse(BaseModel):
    auth_type: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    is_whitelisted: bool
    free_turns_used: int
    free_turns_remaining: int
    has_own_api_key: bool
    provider: str

class AuthConfigResponse(BaseModel):
    google_client_id: str
    google_auth_enabled: bool
    max_free_turns: int
    free_model: str
    free_provider: str

class DocumentUploadResponse(BaseModel):
    document_id: str
    message: str
    chunk_count: int
    file_name: str
    file_type: str
    summary: Optional[str] = None
    suggested_questions: Optional[List[str]] = None

class RAGQueryRequest(BaseModel):
    question: str
    developer_message: str  # System message from the developer/UI
    k: Optional[int] = 5  # Number of relevant chunks to retrieve
    model: Optional[str] = "gpt-4.1"  # Model selection for RAG queries
    mode: Optional[str] = "rag"  # RAG mode: "rag" or "topic-explorer"
    provider: Optional[str] = "openai"  # Provider selection: "openai" or "together"
    
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
    
    @field_validator('developer_message')
    @classmethod
    def validate_developer_message(cls, v):
        """Validate developer/system message content"""
        if not v or not isinstance(v, str):
            raise ValueError('Developer message is required')
        
        if len(v) > 5000:  # Reasonable limit for system message
            raise ValueError('Developer message is too long (max 5,000 characters)')
        
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
        
        # List of allowed models for OpenAI
        openai_models = [
            "gpt-4", "gpt-4-mini", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
            "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-5", "gpt-5-mini", "gpt-5-nano"
        ]
        
        # List of allowed models for Together.ai
        together_models = [
            "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-V3.1", "deepseek-ai/DeepSeek-V3",
            "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "openai/gpt-oss-20b", "openai/gpt-oss-120b", "moonshotai/Kimi-K2-Instruct-0905",
            "Qwen/Qwen3-Next-80B-A3B-Thinking"
        ]
        
        all_models = openai_models + together_models
        
        if v not in all_models:
            raise ValueError(f'Invalid model: {v}. Allowed models: {", ".join(all_models)}')
        
        return v
    
    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v):
        """Validate provider selection"""
        if not v:
            return "openai"  # Default provider
        
        allowed_providers = ["openai", "together"]
        if v.lower() not in allowed_providers:
            raise ValueError(f'Invalid provider: {v}. Allowed providers: {", ".join(allowed_providers)}')
        
        return v.lower()

class RAGQueryResponse(BaseModel):
    answer: str
    relevant_chunks_count: int
    document_info: Dict[str, Any]

# Endpoint to create a new session (backward compatible)
@app.post(
    "/api/session",
    response_model=SessionResponse,
    tags=["Authentication"],
    summary="Create a new session",
    description="Create a new authenticated session using your API key (optional). Returns a session ID that you'll use for subsequent requests. If no API key is provided, creates a guest session with free tier access.",
    responses={
        200: {"description": "Session created successfully"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("30/minute")  # Limit to 30 session creations per minute per IP (increased for better UX during development)
async def create_session_endpoint(request: Request, session_request: SessionRequest):
    try:
        # Create session with API key if provided, otherwise create guest session
        if session_request.api_key:
            session_id = create_session(
                auth_type="api_key",
                api_key=session_request.api_key,
                provider=session_request.provider
            )
            message = "Session created successfully with API key"
        else:
            session_id = create_session(
                auth_type="guest",
                provider=session_request.provider
            )
            message = f"Guest session created successfully ({MAX_FREE_TURNS} free turns available)"

        return SessionResponse(
            session_id=session_id,
            message=message
        )
    except Exception as e:
        print(f"Error creating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to create a guest session
@app.post(
    "/api/auth/guest",
    response_model=AuthLoginResponse,
    tags=["Authentication"],
    summary="Create a guest session",
    description=f"Create a guest session with free tier access ({MAX_FREE_TURNS} turns). No authentication required.",
    responses={
        200: {"description": "Guest session created successfully"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("10/minute")  # More restrictive rate limit for guest sessions
async def create_guest_session(request: Request):
    try:
        session_id = create_session(auth_type="guest", provider=FREE_PROVIDER)
        return {
            "session_id": session_id,
            "message": f"Guest session created successfully ({MAX_FREE_TURNS} free turns available)",
            "user": {
                "auth_type": "guest",
                "email": None,
                "name": "Guest",
                "picture": None,
                "is_whitelisted": False,
                "free_turns_remaining": MAX_FREE_TURNS,
                "has_own_api_key": False,
                "session_id": session_id
            }
        }
    except Exception as e:
        print(f"Error creating guest session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to authenticate with Google OAuth
@app.post(
    "/api/auth/google",
    response_model=AuthLoginResponse,
    tags=["Authentication"],
    summary="Authenticate with Google",
    description="Authenticate using Google OAuth. Provide the Google ID token from the frontend.",
    responses={
        200: {"description": "Google authentication successful"},
        401: {"description": "Invalid Google ID token"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("20/minute")
async def google_auth(request: Request, auth_request: GoogleAuthRequest):
    try:
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=500,
                detail="Google OAuth not configured on server"
            )

        # Verify the Google ID token
        try:
            idinfo = id_token.verify_oauth2_token(
                auth_request.credential,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )

            # Extract user information
            email = idinfo.get('email')
            name = idinfo.get('name')
            picture = idinfo.get('picture')

            if not email:
                raise HTTPException(status_code=401, detail="Email not found in Google token")

            # Create session with Google auth
            session_id = create_session(
                auth_type="google",
                email=email,
                name=name,
                picture=picture,
                provider=FREE_PROVIDER
            )

            # Get whitelisted status from session (already computed in create_session)
            session = get_session(session_id)
            is_whitelisted = session["is_whitelisted"]

            if is_whitelisted:
                message = f"Welcome {name}! You have unlimited access."
                free_turns_remaining = -1  # Unlimited
            else:
                message = f"Welcome {name}! You have {MAX_FREE_TURNS} free turns."
                free_turns_remaining = MAX_FREE_TURNS

            return {
                "session_id": session_id,
                "message": message,
                "user": {
                    "auth_type": "google",
                    "email": email,
                    "name": name,
                    "picture": picture,
                    "is_whitelisted": is_whitelisted,
                    "free_turns_remaining": free_turns_remaining,
                    "has_own_api_key": False,
                    "session_id": session_id
                }
            }

        except ValueError as e:
            # Invalid token
            raise HTTPException(status_code=401, detail=f"Invalid Google ID token: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in Google authentication: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to get current user info
@app.get(
    "/api/auth/me",
    response_model=AuthMeResponse,
    tags=["Authentication"],
    summary="Get current user info",
    description="Get information about the currently authenticated user/session.",
    responses={
        200: {"description": "User info retrieved successfully"},
        401: {"description": "Invalid or expired session"}
    }
)
@limiter.limit("30/minute")
async def get_current_user(
    request: Request,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    free_turns_remaining = max(0, MAX_FREE_TURNS - session["free_turns_used"])
    if session.get("is_whitelisted"):
        free_turns_remaining = -1  # Unlimited for whitelisted users

    return AuthMeResponse(
        auth_type=session["auth_type"],
        email=session.get("email"),
        name=session.get("name"),
        picture=session.get("picture"),
        is_whitelisted=session.get("is_whitelisted", False),
        free_turns_used=session["free_turns_used"],
        free_turns_remaining=free_turns_remaining,
        has_own_api_key=session.get("has_own_api_key", False),
        provider=session.get("provider", "openai")
    )

# Endpoint to logout (delete session)
@app.post(
    "/api/auth/logout",
    tags=["Authentication"],
    summary="Logout",
    description="Logout and delete the current session.",
    responses={
        200: {"description": "Logout successful"},
        401: {"description": "Invalid or expired session"}
    }
)
@limiter.limit("30/minute")
async def logout(
    request: Request,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    # Delete session and its conversations
    if x_session_id in conversations:
        del conversations[x_session_id]
    if x_session_id in sessions:
        del sessions[x_session_id]

    return {"message": "Logout successful"}

# Endpoint to get auth configuration
@app.get(
    "/api/auth/config",
    response_model=AuthConfigResponse,
    tags=["Authentication"],
    summary="Get authentication configuration",
    description="Get public authentication configuration (Google Client ID, free tier limits, etc.).",
    responses={
        200: {"description": "Configuration retrieved successfully"}
    }
)
@limiter.limit("60/minute")
async def get_auth_config(request: Request):
    return AuthConfigResponse(
        google_client_id=GOOGLE_CLIENT_ID,
        google_auth_enabled=bool(GOOGLE_CLIENT_ID),
        max_free_turns=MAX_FREE_TURNS,
        free_model=FREE_MODEL,
        free_provider=FREE_PROVIDER
    )

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
async def chat(
    request: Request, 
    chat_request: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    try:
        # Use session ID from header parameter
        session_id = x_session_id

        # Validate session and get session data
        session = get_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Resolve API key and provider
        api_key, provider = resolve_api_key(session_id, chat_request.api_key, chat_request.provider)

        # Check token limits for free tier users
        if not session.get("has_own_api_key") and not session.get("is_whitelisted"):
            # Count tokens in user message
            token_count = count_tokens(chat_request.user_message, chat_request.model)
            if token_count > MAX_FREE_MESSAGE_TOKENS:
                raise HTTPException(
                    status_code=403,
                    detail=f"Message too long for free tier ({token_count} tokens, max {MAX_FREE_MESSAGE_TOKENS}). Please provide your own API key."
                )

        # Debug logging
        print(f"Received chat request: session_id={session_id[:8]}..., provider={provider}, model={chat_request.model}, user_message_length={len(chat_request.user_message)}")

        # Initialize OpenAI client with the resolved API key and provider
        client_kwargs = {"api_key": api_key}
        if provider == "together":
            client_kwargs["base_url"] = "https://api.together.xyz/v1"
        client = OpenAI(**client_kwargs)
        
        # Get session-specific conversations
        user_conversations = get_session_conversations(session_id)
        
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
                    # Some providers may send chunks without choices or content (e.g., role updates or keep-alives)
                    try:
                        choices = getattr(chunk, "choices", None)
                        if not choices or len(choices) == 0:
                            continue
                        choice0 = choices[0]
                        delta = getattr(choice0, "delta", None)
                        content = getattr(delta, "content", None) if delta is not None else None
                        if content:
                            full_response += content
                            yield content
                    except Exception:
                        # Be tolerant to provider-specific streaming variations
                        continue
                
                # Store the assistant's response in conversation history
                assistant_message = Message(
                    role="assistant",
                    content=full_response,
                    timestamp=datetime.now(timezone.utc)
                )
                user_conversations[conversation_id]["messages"].append(assistant_message)
                user_conversations[conversation_id]["last_updated"] = datetime.now(timezone.utc)

                # Increment free turns counter if using server API key
                if not session.get("has_own_api_key") and not session.get("is_whitelisted"):
                    session["free_turns_used"] += 1
                    print(f"Free turn used: {session['free_turns_used']}/{MAX_FREE_TURNS} for session {session_id[:8]}...")

            except Exception as e:
                # Remove the user message if the API call failed
                if user_conversations[conversation_id]["messages"]:
                    user_conversations[conversation_id]["messages"].pop()
                raise e

        # Calculate free turns remaining before creating response
        if session.get("is_whitelisted"):
            free_turns_remaining = -1  # Unlimited
        else:
            free_turns_remaining = max(0, MAX_FREE_TURNS - session["free_turns_used"])

        # Return a streaming response to the client with conversation ID in headers
        response = StreamingResponse(generate(), media_type="text/plain")
        response.headers["X-Conversation-ID"] = conversation_id
        response.headers["X-Free-Turns-Remaining"] = str(free_turns_remaining)
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
async def get_conversation(
    request: Request, 
    conversation_id: str,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    # Use session ID from header parameter
    session_id = x_session_id
    
    # Validate session
    if not get_session(session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get session-specific conversations
    user_conversations = get_session_conversations(session_id)
    
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
async def list_conversations(
    request: Request,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    # Use session ID from header parameter
    session_id = x_session_id
    
    # Validate session
    if not get_session(session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get session-specific conversations
    user_conversations = get_session_conversations(session_id)
    
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
async def delete_conversation(
    request: Request, 
    conversation_id: str,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    # Use session ID from header parameter
    session_id = x_session_id
    
    # Validate session
    if not get_session(session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get session-specific conversations
    user_conversations = get_session_conversations(session_id)
    
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
async def clear_all_conversations(
    request: Request,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication")
):
    # Use session ID from header parameter
    session_id = x_session_id
    
    # Validate session
    if not get_session(session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get session-specific conversations and clear them
    user_conversations = get_session_conversations(session_id)
    user_conversations.clear()
    
    return {"message": "All conversations cleared successfully"}

# Document Upload endpoint
@app.post(
    "/api/upload-document",
    response_model=DocumentUploadResponse,
    tags=["Document RAG"],
    summary="Upload a document",
    description="Upload and process a document (PDF, Word, PowerPoint) for RAG (Retrieval-Augmented Generation) functionality. The document will be chunked and indexed for later querying.",
    responses={
        200: {"description": "Document processed and indexed successfully"},
        400: {"description": "Invalid file type or size"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"},
        503: {"description": "RAG functionality not available"}
    }
)
@limiter.limit("3/minute")  # Limit to 3 document uploads per minute per IP
async def upload_document(
    request: Request,
    file: UploadFile = File(..., description="Document file to upload (PDF, DOCX, PPTX - max 20MB)"),
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key", description="API key for document processing (optional)"),
    x_provider: Optional[str] = Header(None, alias="X-Provider", description="Provider for document processing (openai or together)")
):
    """Upload and process a document file for RAG functionality."""

    # Check if RAG is enabled
    if not RAG_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="RAG functionality is not available in this deployment. Please install optional dependencies: pip install -e '.[rag]'"
        )
    try:
        # Use session ID from header parameter
        session_id = x_session_id

        # Validate session and resolve API key
        session = get_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Resolve API key and provider
        api_key, provider = resolve_api_key(session_id, x_api_key, x_provider)
        
        # Validate file type
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        file_extension = file.filename.lower().split('.')[-1]
        supported_types = ['pdf', 'docx', 'doc', 'pptx', 'ppt']
        
        if file_extension not in supported_types:
            supported_types_str = ', '.join(f'.{t}' for t in supported_types)
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: .{file_extension}. Supported types: {supported_types_str}"
            )
        
        # Validate file size (max20)
        file_content = await file.read()
        if len(file_content) > 20 * 1024 * 1024:  # 20MB
            raise HTTPException(status_code=400, detail="File size too large (max 20MB)")
        
        # Create temporary file with appropriate extension
        temp_suffix = f'.{file_extension}'
        with tempfile.NamedTemporaryFile(delete=False, suffix=temp_suffix) as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        try:
            # Process document using DocumentProcessor
            document_processor = DocumentProcessor()
            processed_data = document_processor.process_document(temp_file_path)
            
            # Generate document ID
            # document_id = str(uuid.uuid4())
            document_id = file.filename
            
            # Get or create RAG system for this session with the specified provider
            rag_system = get_or_create_rag_system(session_id, api_key, provider)
            
            # Index the document
            await rag_system.index_document(
                document_id=document_id,
                chunks=processed_data["chunks"],
                metadata=processed_data["metadata"]
            )
            
            # Generate document summary and suggested questions using ChatOpenAI
            summary = None
            suggested_questions = None
            
            try:
                # Prepare document content for summarization
                document_content = "\n\n".join(processed_data["chunks"])
                
                # System message for summarization
                system_message = """
                You are a helpful assistant. Please, summarize this document content and return 5 suggested prompts/questions about it. 
                These questions will be presented to the user so it can start a conversation with you about.

                Aways respond with a JSON object in the following strict format:
                {
                    "summary": "Brief summary of the document content",
                    "suggested_questions": ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
                }"""
                
                # Create the prompt for summarization
                user_message = f"Please summarize the following document content and provide 5 suggested questions:\n\n{document_content}"
                
                # Generate summary and suggested questions
                # Initialize ChatOpenAI with the provided API key and provider
                kwargs = {}
                kwargs["response_format"] = {"type": "json_object"}
                chat_model = ChatOpenAI(api_key=api_key, provider=provider)
                response = chat_model.run(
                    model_name="gpt-4.1-mini" if provider == "openai" else "deepseek-ai/DeepSeek-V3.1",
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ],
                    **kwargs
                )
                
                # Parse the JSON response to extract summary and questions
                try:
                    import json
                    parsed_response = json.loads(response)
                    summary = parsed_response.get("summary", "Summary not available")
                    suggested_questions = parsed_response.get("suggested_questions", [])
                    
                    # Ensure we have exactly 5 questions
                    if len(suggested_questions) < 5:
                        # Add generic questions if we don't have enough
                        generic_questions = [
                            "What are the main topics covered in this document?",
                            "Can you explain the key concepts mentioned?",
                            "What are the important details I should know?",
                            "How does this content relate to practical applications?",
                            "What questions do you have about this material?"
                        ]
                        while len(suggested_questions) < 5:
                            suggested_questions.append(generic_questions[len(suggested_questions)])
                    elif len(suggested_questions) > 5:
                        # Trim to 5 questions if we have too many
                        suggested_questions = suggested_questions[:5]
                        
                except json.JSONDecodeError:
                    # If JSON parsing fails, use the raw response as summary
                    summary = response
                    suggested_questions = [
                        "What are the main topics covered in this document?",
                        "Can you explain the key concepts mentioned?",
                        "What are the important details I should know?",
                        "How does this content relate to practical applications?",
                        "What questions do you have about this material?"
                    ]
                
            except Exception as e:
                print(f"Error generating document summary: {str(e)}")
                # Continue without summary if generation fails
                summary = "Summary generation failed due to an error."
                suggested_questions = [
                    "What are the main topics covered in this document?",
                    "Can you explain the key concepts mentioned?",
                    "What are the important details I should know?",
                    "How does this content relate to practical applications?",
                    "What questions do you have about this material?"
                ]
            
            return DocumentUploadResponse(
                document_id=document_id,
                message=f"{processed_data['metadata']['file_type'].upper()} document processed and indexed successfully",
                chunk_count=processed_data["chunk_count"],
                file_name=document_id, #processed_data["metadata"]["file_name"],
                file_type=processed_data["metadata"]["file_type"],
                summary=summary,
                suggested_questions=suggested_questions
            )
            
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
    
    except Exception as e:
        print(f"Error in document upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# RAG Query endpoint
@app.post(
    "/api/rag-query",
    response_model=RAGQueryResponse,
    tags=["Document RAG"],
    summary="Query uploaded documents",
    description="Ask questions about uploaded documents (PDF, Word, PowerPoint) using RAG (Retrieval-Augmented Generation). Returns relevant answers based on document content.",
    responses={
        200: {"description": "RAG query processed successfully"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"},
        503: {"description": "RAG functionality not available"}
    }
)
@limiter.limit("20/minute")  # Limit to 20 RAG queries per minute per IP
async def rag_query(
    request: Request,
    query_request: RAGQueryRequest,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key", description="API key for RAG processing (optional)"),
    x_conversation_id: Optional[str] = Header(None, alias="X-Conversation-ID", description="Conversation ID for tracking RAG queries")
):
    """Query the RAG system with a question."""

    # Check if RAG is enabled
    if not RAG_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="RAG functionality is not available in this deployment. Please install optional dependencies: pip install -e '.[rag]'"
        )

    try:
        # Use session ID from header parameter
        session_id = x_session_id

        # Validate session and resolve API key
        session = get_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Resolve API key and provider
        api_key, provider = resolve_api_key(session_id, x_api_key, query_request.provider)

        # Check token limits for free tier users
        if not session.get("has_own_api_key") and not session.get("is_whitelisted"):
            # Count tokens in user question
            token_count = count_tokens(query_request.question, query_request.model)
            if token_count > MAX_FREE_MESSAGE_TOKENS:
                raise HTTPException(
                    status_code=403,
                    detail=f"Message too long for free tier ({token_count} tokens, max {MAX_FREE_MESSAGE_TOKENS}). Please provide your own API key."
                )

        # Debug logging
        print(f"Received RAG query request: session_id={session_id[:8]}..., provider={provider}, model={query_request.model}, question_length={len(query_request.question)}")
        
        # Get RAG system for this session with the resolved provider
        rag_system = get_or_create_rag_system(session_id, api_key, provider)
        
        # Query the RAG system with the specified mode and developer message
        answer = rag_system.query(query_request.question, k=query_request.k, mode=query_request.mode, model_name=query_request.model, system_message=query_request.developer_message)
        
        # Get document info
        doc_info = rag_system.get_document_info()
        
        # Get relevant chunks count (approximate)
        relevant_chunks = rag_system.search_relevant_chunks(query_request.question, k=query_request.k)
        relevant_chunks_count = len(relevant_chunks)
        
        # Store the RAG conversation in session-scoped conversation history
        user_conversations = get_session_conversations(session_id)
        
        # Generate or retrieve conversation ID from header parameter
        conversation_id = x_conversation_id or str(uuid.uuid4())
        
        # Initialize conversation if it doesn't exist
        if conversation_id not in user_conversations:
            user_conversations[conversation_id] = {
                "messages": [],
                "system_message": query_request.developer_message,
                "title": None,  # Will be set when first user message is added
                "created_at": datetime.now(timezone.utc),
                "last_updated": datetime.now(timezone.utc),
                "mode": query_request.mode or "rag"  # RAG mode for document queries
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

        # Increment free turns counter if using server API key
        if not session.get("has_own_api_key") and not session.get("is_whitelisted"):
            session["free_turns_used"] += 1
            print(f"Free turn used (RAG): {session['free_turns_used']}/{MAX_FREE_TURNS} for session {session_id[:8]}...")

        # Calculate free turns remaining
        if session.get("is_whitelisted"):
            free_turns_remaining = -1  # Unlimited
        else:
            free_turns_remaining = max(0, MAX_FREE_TURNS - session["free_turns_used"])

        # Create response with conversation ID in headers
        response = RAGQueryResponse(
            answer=answer,
            relevant_chunks_count=relevant_chunks_count,
            document_info=doc_info
        )

        # Return response with conversation ID and free turns remaining in headers
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content=response.model_dump(),
            headers={
                "X-Conversation-ID": conversation_id,
                "X-Free-Turns-Remaining": str(free_turns_remaining)
            }
        )
    
    except Exception as e:
        print(f"Error in RAG query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get document info endpoint
@app.get(
    "/api/documents",
    tags=["Document RAG"],
    summary="Get uploaded documents info",
    description="Retrieve information about all uploaded documents for the current session, including metadata and chunk counts.",
    responses={
        200: {"description": "Document information retrieved successfully"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"},
        503: {"description": "RAG functionality not available"}
    }
)
@limiter.limit("10/minute")  # Limit to 10 requests per minute per IP
async def get_documents(
    request: Request,
    x_session_id: str = Header(..., alias="X-Session-ID", description="Session ID for authentication"),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key", description="API key for document processing (optional)"),
    x_provider: Optional[str] = Header(None, alias="X-Provider", description="Provider for document processing (openai or together)")
):
    """Get information about uploaded documents for the session."""

    # Check if RAG is enabled
    if not RAG_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="RAG functionality is not available in this deployment. Please install optional dependencies: pip install -e '.[rag]'"
        )

    try:
        # Use session ID from header parameter
        session_id = x_session_id

        # Validate session and resolve API key
        session = get_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Resolve API key and provider
        api_key, provider = resolve_api_key(session_id, x_api_key, x_provider)

        # Get RAG system for this session with the resolved provider
        rag_system = get_or_create_rag_system(session_id, api_key, provider)
        
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
