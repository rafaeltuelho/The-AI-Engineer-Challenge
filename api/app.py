# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel, validator
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
# Import slowapi for rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import re

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

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
conversations: Dict[str, Dict[str, Any]] = {}

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None  # ID to continue existing conversation
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication
    
    @validator('api_key')
    def validate_api_key(cls, v):
        """Validate OpenAI API key format"""
        if not v or not isinstance(v, str):
            raise ValueError('API key is required')
        
        # OpenAI API keys typically start with 'sk-' and are 51 characters long
        if not v.startswith('sk-'):
            raise ValueError('Invalid API key format: must start with "sk-"')
        
        if len(v) < 20 or len(v) > 100:
            raise ValueError('Invalid API key length')
        
        # Check for basic format (alphanumeric and some special chars)
        if not re.match(r'^sk-[A-Za-z0-9_-]+$', v):
            raise ValueError('Invalid API key format: contains invalid characters')
        
        return v
    
    @validator('user_message')
    def validate_user_message(cls, v):
        """Validate user message content"""
        if not v or not isinstance(v, str):
            raise ValueError('User message is required')
        
        if len(v.strip()) == 0:
            raise ValueError('User message cannot be empty')
        
        if len(v) > 10000:  # Reasonable limit for message length
            raise ValueError('User message is too long (max 10,000 characters)')
        
        return v.strip()
    
    @validator('developer_message')
    def validate_developer_message(cls, v):
        """Validate developer/system message content"""
        if not v or not isinstance(v, str):
            raise ValueError('Developer message is required')
        
        if len(v) > 5000:  # Reasonable limit for system message
            raise ValueError('Developer message is too long (max 5,000 characters)')
        
        return v.strip()
    
    @validator('model')
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
    
    @validator('conversation_id')
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

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
@limiter.limit("10/minute")  # Limit to 10 requests per minute per IP
async def chat(request: Request, chat_request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=chat_request.api_key)
        
        # Generate or retrieve conversation ID
        conversation_id = chat_request.conversation_id or str(uuid.uuid4())
        
        # Initialize conversation if it doesn't exist
        if conversation_id not in conversations:
            conversations[conversation_id] = {
                "messages": [],
                "system_message": chat_request.developer_message,
                "title": None,  # Will be set when first user message is added
                "created_at": datetime.utcnow(),
                "last_updated": datetime.utcnow()
            }
        
        # Add user message to conversation history
        user_message = Message(
            role="user",
            content=chat_request.user_message,
            timestamp=datetime.utcnow()
        )
        conversations[conversation_id]["messages"].append(user_message)
        conversations[conversation_id]["last_updated"] = datetime.utcnow()
        
        # Set conversation title from first user message if not already set
        if conversations[conversation_id]["title"] is None:
            # Use first line of the user message as title (max 50 characters)
            first_line = chat_request.user_message.split('\n')[0].strip()
            conversations[conversation_id]["title"] = first_line[:50] + ("..." if len(first_line) > 50 else "")
        
        # Build the full conversation context for OpenAI
        messages_for_openai = [
            {"role": "system", "content": conversations[conversation_id]["system_message"]}
        ]
        
        # Add conversation history (limit to last 20 messages to avoid token limits)
        recent_messages = conversations[conversation_id]["messages"][-20:]
        for msg in recent_messages:
            # Map our roles to OpenAI's expected roles
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
                    timestamp=datetime.utcnow()
                )
                conversations[conversation_id]["messages"].append(assistant_message)
                conversations[conversation_id]["last_updated"] = datetime.utcnow()
                
            except Exception as e:
                # Remove the user message if the API call failed
                if conversations[conversation_id]["messages"]:
                    conversations[conversation_id]["messages"].pop()
                raise e

        # Return a streaming response to the client with conversation ID in headers
        response = StreamingResponse(generate(), media_type="text/plain")
        response.headers["X-Conversation-ID"] = conversation_id
        return response
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to get conversation history
@app.get("/api/conversations/{conversation_id}")
@limiter.limit("30/minute")  # Limit to 30 requests per minute per IP
async def get_conversation(request: Request, conversation_id: str):
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "conversation_id": conversation_id,
        "title": conversations[conversation_id].get("title", "New Conversation"),
        "system_message": conversations[conversation_id]["system_message"],
        "messages": conversations[conversation_id]["messages"],
        "created_at": conversations[conversation_id]["created_at"],
        "last_updated": conversations[conversation_id]["last_updated"]
    }

# Endpoint to list all conversations
@app.get("/api/conversations")
@limiter.limit("20/minute")  # Limit to 20 requests per minute per IP
async def list_conversations(request: Request):
    conversation_list = []
    for conv_id, conv_data in conversations.items():
        conversation_list.append({
            "conversation_id": conv_id,
            "title": conv_data.get("title", "New Conversation"),
            "system_message": conv_data["system_message"],
            "message_count": len(conv_data["messages"]),
            "created_at": conv_data["created_at"],
            "last_updated": conv_data["last_updated"]
        })
    
    # Sort by last updated (most recent first)
    conversation_list.sort(key=lambda x: x["last_updated"], reverse=True)
    return conversation_list

# Endpoint to delete a conversation
@app.delete("/api/conversations/{conversation_id}")
@limiter.limit("10/minute")  # Limit to 10 requests per minute per IP
async def delete_conversation(request: Request, conversation_id: str):
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    del conversations[conversation_id]
    return {"message": "Conversation deleted successfully"}

# Endpoint to clear all conversations
@app.delete("/api/conversations")
@limiter.limit("5/minute")  # Limit to 5 requests per minute per IP (more restrictive)
async def clear_all_conversations(request: Request):
    conversations.clear()
    return {"message": "All conversations cleared successfully"}

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
