# FastAPI + Pydantic Best Practices

**Version 1.0.0**  
The AI Engineer Challenge  
March 2026

> **Note:**  
> This document is mainly for agents and LLMs to follow when maintaining,  
> generating, or refactoring FastAPI and Pydantic codebases. Humans  
> may also find it useful, but guidance here is optimized for automation  
> and consistency by AI-assisted workflows.

---

## Abstract

Comprehensive guide for building production-ready FastAPI applications with Pydantic, designed for AI agents and LLMs. Contains 40+ rules across 8 categories, prioritized by impact from critical (security, validation) to incremental (API design patterns). Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific patterns relevant to this codebase.

---

## Table of Contents

1. [Security & Authentication](#1-security--authentication) — **CRITICAL**
2. [Request/Response Modeling](#2-requestresponse-modeling) — **HIGH**
3. [Validation Patterns](#3-validation-patterns) — **HIGH**
4. [Error Handling](#4-error-handling) — **MEDIUM-HIGH**
5. [File & Image Processing](#5-file--image-processing) — **MEDIUM**
6. [Performance & Optimization](#6-performance--optimization) — **MEDIUM**
7. [Testing Patterns](#7-testing-patterns) — **MEDIUM**
8. [API Design](#8-api-design) — **LOW-MEDIUM**

---

## 1. Security & Authentication

**Impact: CRITICAL**

Security vulnerabilities can lead to data breaches, unauthorized access, and system compromise. Always prioritize security in API design.

### 1.1 Always Validate Session in Endpoints

**Impact: CRITICAL (prevents unauthorized access)**

Every protected endpoint must validate the session ID and verify it exists and is valid. Never trust client-provided session IDs without validation.

**Incorrect: no session validation**

```python
@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID")
):
    # Directly uses session_id without validation
    api_key = sessions[x_session_id]["api_key"]
    # Process request...
```

This code assumes the session exists and is valid, which can lead to KeyError or unauthorized access.

**Correct: validate session first**

```python
@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID")
):
    # Validate session exists and is valid
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Now safe to use session data
    api_key = session.get("api_key")
    # Process request...
```

**Best practice: use dependency injection**

```python
from fastapi import Depends

async def get_current_session(
    x_session_id: str = Header(..., alias="X-Session-ID")
) -> dict:
    """Dependency to validate and return current session"""
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session

@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    session: dict = Depends(get_current_session)
):
    # Session is already validated
    api_key = session.get("api_key")
    # Process request...
```

### 1.2 Never Log or Expose API Keys

**Impact: CRITICAL (prevents credential leakage)**

API keys, passwords, and other credentials must never appear in logs, error messages, or responses. Always redact sensitive data.

**Incorrect: logs API key**

```python
@app.post("/api/session")
async def create_session(session_request: SessionRequest):
    print(f"Creating session with API key: {session_request.api_key}")
    session_id = create_session(api_key=session_request.api_key)
    return {"session_id": session_id}
```

**Correct: redact sensitive data**

```python
@app.post("/api/session")
async def create_session(session_request: SessionRequest):
    # Log without exposing the key
    has_key = session_request.api_key is not None
    print(f"Creating session with API key: {'provided' if has_key else 'not provided'}")
    
    session_id = create_session(api_key=session_request.api_key)
    return {"session_id": session_id}
```

**Also avoid in error messages:**

```python
# Incorrect
raise HTTPException(
    status_code=401,
    detail=f"Invalid API key: {api_key}"
)

# Correct
raise HTTPException(
    status_code=401,
    detail="Invalid API key provided"
)
```

### 1.3 Apply Rate Limiting to All Public Endpoints

**Impact: HIGH (prevents abuse and DoS attacks)**

Use rate limiting on all public endpoints to prevent abuse. Different endpoints should have different limits based on their resource intensity.

**Implementation with slowapi:**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply different limits based on endpoint cost
@app.post("/api/chat")
@limiter.limit("10/minute")  # Expensive: AI generation
async def chat(request: Request, chat_request: ChatRequest):
    pass

@app.post("/api/session")
@limiter.limit("10/minute")  # Moderate: session creation
async def create_session(request: Request, session_request: SessionRequest):
    pass

@app.get("/api/config")
@limiter.limit("30/minute")  # Cheap: read-only config
async def get_config(request: Request):
    pass

@app.post("/api/upload")
@limiter.limit("3/minute")  # Very expensive: file processing
async def upload_document(request: Request, file: UploadFile):
    pass
```

**Important notes:**

- Always pass `Request` as first parameter when using `@limiter.limit()`
- Set limits based on resource cost (CPU, memory, external API calls)
- Consider implementing per-user limits in addition to per-IP limits
- Return clear error messages when rate limit is exceeded

### 1.4 Sanitize and Validate All User Inputs

**Impact: CRITICAL (prevents injection attacks)**

Never trust user input. Always validate, sanitize, and enforce limits on all incoming data to prevent injection attacks and resource exhaustion.

**Incorrect: no validation**

```python
class ChatRequest(BaseModel):
    user_message: str
    developer_message: str
```

**Correct: comprehensive validation**

```python
class ChatRequest(BaseModel):
    user_message: str
    developer_message: str

    @field_validator('user_message')
    @classmethod
    def validate_user_message(cls, v):
        """Validate user message content"""
        if not v or not isinstance(v, str):
            raise ValueError('User message is required')

        if len(v.strip()) == 0:
            raise ValueError('User message cannot be empty')

        if len(v) > 10000:  # Reasonable limit
            raise ValueError('User message is too long (max 10,000 characters)')

        return v.strip()

    @field_validator('developer_message')
    @classmethod
    def validate_developer_message(cls, v):
        """Validate developer/system message content"""
        if not v or not isinstance(v, str):
            raise ValueError('Developer message is required')

        if len(v) > 5000:  # Reasonable limit
            raise ValueError('Developer message is too long (max 5,000 characters)')

        return v.strip()
```

**Key validation patterns:**

- Check type with `isinstance()`
- Validate non-empty with `len(v.strip()) > 0`
- Enforce maximum length to prevent resource exhaustion
- Strip whitespace with `.strip()` for consistency
- Return sanitized value, not original input

### 1.5 Configure CORS Restrictively

**Impact: MEDIUM-HIGH (prevents unauthorized cross-origin access)**

In production, configure CORS to allow only specific origins. The wildcard `"*"` should only be used in development.

**Incorrect: allows all origins in production**

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dangerous in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Correct: restrict origins in production**

```python
import os

# Get allowed origins from environment variable
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Specific origins only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Specific methods
    allow_headers=["Content-Type", "Authorization", "X-Session-ID"],  # Specific headers
    expose_headers=["X-Conversation-ID", "X-Free-Turns-Remaining"],
)
```

**Best practice:**

- Use environment variables for configuration
- List specific origins, not wildcards
- Limit allowed methods to what you actually use
- Limit allowed headers to what you actually need
- Only expose headers that clients need to read

---

## 2. Request/Response Modeling

**Impact: HIGH**

Proper Pydantic modeling ensures type safety, automatic validation, and clear API contracts.

### 2.1 Use field_validator for Single-Field Validation

**Impact: HIGH (ensures data integrity)**

Use `@field_validator` decorator for validating individual fields. This runs after Pydantic's built-in type validation.

**Correct pattern:**

```python
from pydantic import BaseModel, field_validator

class SessionRequest(BaseModel):
    api_key: Optional[str] = None
    provider: Optional[str] = "openai"

    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v):
        """Validate API key format if provided"""
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError('API key must be a string')

        # Treat empty/whitespace-only strings as "no key provided"
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
            raise ValueError(
                f'Invalid provider: {v}. Allowed providers: {", ".join(allowed_providers)}'
            )

        return v.lower()
```

**Key points:**

- Always use `@classmethod` decorator
- First parameter is `cls`, second is the field value `v`
- Return the validated (and possibly transformed) value
- Raise `ValueError` with clear message for validation failures
- Can return `None` or default values when appropriate

### 2.2 Use model_validator for Cross-Field Validation

**Impact: MEDIUM-HIGH (validates relationships between fields)**

Use `@model_validator` when validation logic depends on multiple fields. This runs after all field validators.

**Example: validate image attachment only for compatible models**

```python
from pydantic import BaseModel, model_validator
from typing import Optional

class ImageAttachment(BaseModel):
    data_url: str
    mime_type: str

class ChatRequest(BaseModel):
    user_message: str
    model: str = "gpt-5-mini"
    provider: str = "openai"
    image_attachment: Optional[ImageAttachment] = None

    @model_validator(mode='after')
    def validate_image_compatibility(self):
        """Ensure image attachments are only used with compatible models"""
        if self.image_attachment:
            # Images only work with OpenAI GPT models
            if self.provider != "openai":
                raise ValueError(
                    f"Image attachments are not supported with provider '{self.provider}'. "
                    "Please use 'openai' provider for image support."
                )

            # Verify model supports vision
            vision_models = ["gpt-5", "gpt-5-mini"]
            if self.model not in vision_models:
                raise ValueError(
                    f"Image attachments are not supported with model '{self.model}'. "
                    f"Supported models: {', '.join(vision_models)}"
                )

        return self
```

**Key points:**

- Use `mode='after'` to run after field validators
- Access all fields via `self.field_name`
- Must return `self` at the end
- Raise `ValueError` for validation failures
- Use for validating field combinations and dependencies

### 2.3 Use Optional[] with Defaults for Optional Fields

**Impact: MEDIUM (clear API contracts)**

Always use `Optional[Type]` with explicit defaults for optional fields. This makes the API contract clear and prevents confusion.

**Incorrect: ambiguous optionality**

```python
class ChatRequest(BaseModel):
    conversation_id: str  # Is this required?
    model: str  # What's the default?
    api_key: str  # Required or optional?
```

**Correct: explicit optionality**

```python
from typing import Optional

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None  # Clearly optional
    model: Optional[str] = "gpt-5-mini"  # Optional with default
    api_key: Optional[str] = None  # Clearly optional
    user_message: str  # Clearly required (no Optional, no default)
```

**Best practices:**

- Required fields: no `Optional`, no default
- Optional fields: `Optional[Type] = None`
- Optional with default: `Optional[Type] = "default_value"`
- Use `None` as default for truly optional fields
- Use specific defaults when there's a sensible default value

### 2.4 Always Specify response_model in Endpoints

**Impact: HIGH (ensures response validation and documentation)**

Always specify `response_model` in endpoint decorators. This validates responses, generates accurate OpenAPI docs, and prevents accidental data leakage.

**Incorrect: no response model**

```python
@app.post("/api/session")
async def create_session(session_request: SessionRequest):
    session_id = create_session(api_key=session_request.api_key)
    # Returns arbitrary dict - no validation, poor docs
    return {
        "session_id": session_id,
        "message": "Session created",
        "internal_data": "should not be exposed"  # Accidentally exposed!
    }
```

**Correct: explicit response model**

```python
class SessionResponse(BaseModel):
    session_id: str
    message: str

@app.post("/api/session", response_model=SessionResponse)
async def create_session(session_request: SessionRequest):
    session_id = create_session(api_key=session_request.api_key)
    # Only fields in SessionResponse are returned
    return SessionResponse(
        session_id=session_id,
        message="Session created successfully"
    )
```

**Benefits:**

- Validates response data matches the model
- Generates accurate OpenAPI documentation
- Prevents accidental exposure of internal data
- Provides type hints for client code generation
- Makes API contract explicit and enforceable

### 2.5 Use Nested Pydantic Models for Complex Data

**Impact: MEDIUM (improves code organization and reusability)**

Break complex request/response structures into nested Pydantic models for better organization and reusability.

**Incorrect: flat structure**

```python
class DocumentUploadResponse(BaseModel):
    document_id: str
    message: str
    chunk_count: int
    file_name: str
    file_type: str
    file_size: int
    created_at: str
    summary: Optional[str]
    question_1: Optional[str]
    question_2: Optional[str]
    question_3: Optional[str]
    question_4: Optional[str]
    question_5: Optional[str]
```

**Correct: nested models**

```python
class DocumentMetadata(BaseModel):
    file_name: str
    file_type: str
    file_size: int
    created_at: str

class DocumentUploadResponse(BaseModel):
    document_id: str
    message: str
    chunk_count: int
    file_name: str
    file_type: str
    summary: Optional[str] = None
    suggested_questions: Optional[list[str]] = None
```

**Benefits:**

- Easier to understand and maintain
- Models can be reused across endpoints
- Better validation organization
- Clearer API documentation
- Easier to extend without breaking changes

---

## 3. Validation Patterns

**Impact: HIGH**

Comprehensive validation prevents invalid data from entering your system and provides clear error messages to clients.

### 3.1 Validate String Length Limits

**Impact: HIGH (prevents resource exhaustion)**

Always enforce maximum length limits on string fields to prevent resource exhaustion attacks and ensure reasonable data sizes.

**Correct pattern:**

```python
class ChatRequest(BaseModel):
    user_message: str
    developer_message: str

    @field_validator('user_message')
    @classmethod
    def validate_user_message(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('User message is required')

        if len(v.strip()) == 0:
            raise ValueError('User message cannot be empty')

        # Enforce maximum length
        if len(v) > 10000:
            raise ValueError('User message is too long (max 10,000 characters)')

        return v.strip()
```

**Guidelines for length limits:**

- User messages: 10,000 characters (reasonable for chat)
- System messages: 5,000 characters (typically shorter)
- File names: 255 characters (filesystem limit)
- Email addresses: 320 characters (RFC standard)
- URLs: 2,048 characters (browser limit)
- Descriptions: 1,000-5,000 characters depending on use case

### 3.2 Use Literal or Enum for Fixed Choices

**Impact: MEDIUM (ensures valid values)**

Use `Literal` or `Enum` for fields with a fixed set of allowed values. This provides compile-time checking and clear documentation.

**Using Literal:**

```python
from typing import Literal

class SessionRequest(BaseModel):
    provider: Literal["openai", "together"] = "openai"
```

**Using Enum:**

```python
from enum import Enum

class Provider(str, Enum):
    OPENAI = "openai"
    TOGETHER = "together"

class SessionRequest(BaseModel):
    provider: Provider = Provider.OPENAI
```

**With custom validation:**

```python
class SessionRequest(BaseModel):
    provider: Optional[str] = "openai"

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v):
        if not v:
            return "openai"

        allowed_providers = ["openai", "together"]
        if v.lower() not in allowed_providers:
            raise ValueError(
                f'Invalid provider: {v}. Allowed providers: {", ".join(allowed_providers)}'
            )

        return v.lower()
```

**Choose based on needs:**

- `Literal`: Simple, inline definition
- `Enum`: Reusable, better for many values
- Custom validator: When you need transformation (e.g., `.lower()`)

### 3.3 Validate Email Format Properly

**Impact: MEDIUM (ensures valid email addresses)**

Use Pydantic's `EmailStr` type or implement proper email validation to ensure valid email addresses.

**Using Pydantic's EmailStr:**

```python
from pydantic import BaseModel, EmailStr

class UserProfile(BaseModel):
    email: EmailStr  # Automatically validates email format
    name: str
```

**Custom validation:**

```python
import re

class UserProfile(BaseModel):
    email: str
    name: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not v:
            raise ValueError('Email is required')

        # Basic email regex pattern
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('Invalid email format')

        return v.lower()  # Normalize to lowercase
```

### 3.4 Validate File Types and Extensions

**Impact: HIGH (prevents malicious file uploads)**

Always validate both file extensions and MIME types for uploaded files. Don't trust client-provided information alone.

**Correct pattern:**

```python
from fastapi import UploadFile, File, HTTPException

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(..., description="Document file (PDF, DOCX, PPTX)")
):
    # Validate filename exists
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate file extension
    file_extension = file.filename.lower().split('.')[-1]
    supported_types = ['pdf', 'docx', 'doc', 'pptx', 'ppt']

    if file_extension not in supported_types:
        supported_types_str = ', '.join(f'.{t}' for t in supported_types)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{file_extension}. Supported types: {supported_types_str}"
        )

    # Validate MIME type (content_type)
    allowed_mime_types = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'ppt': 'application/vnd.ms-powerpoint'
    }

    expected_mime = allowed_mime_types.get(file_extension)
    if file.content_type != expected_mime:
        raise HTTPException(
            status_code=400,
            detail=f"File content type mismatch. Expected {expected_mime}, got {file.content_type}"
        )

    # Process file...
```

**Key points:**

- Validate both extension and MIME type
- Use lowercase for case-insensitive comparison
- Provide clear error messages with allowed types
- Consider using magic number validation for extra security

### 3.5 Enforce Size Limits on Uploads and Requests

**Impact: CRITICAL (prevents resource exhaustion)**

Always enforce size limits on file uploads and request bodies to prevent resource exhaustion and DoS attacks.

**Correct pattern:**

```python
@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    # Read file content
    file_content = await file.read()

    # Validate file size (20MB limit)
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB in bytes
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size too large (max {MAX_FILE_SIZE // (1024 * 1024)}MB)"
        )

    # Process file...
```

**For image uploads:**

```python
import base64

class ImageAttachment(BaseModel):
    data_url: str  # Base64 encoded image
    mime_type: str

    @field_validator('data_url')
    @classmethod
    def validate_image_size(cls, v):
        if not v:
            raise ValueError('Image data is required')

        # Extract base64 data (remove data:image/...;base64, prefix)
        if ',' in v:
            base64_data = v.split(',', 1)[1]
        else:
            base64_data = v

        # Calculate decoded size
        decoded_size = len(base64_data) * 3 / 4  # Base64 overhead

        MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
        if decoded_size > MAX_IMAGE_SIZE:
            raise ValueError(
                f'Image too large (max {MAX_IMAGE_SIZE // (1024 * 1024)}MB)'
            )

        return v
```

**Recommended size limits:**

- Images: 5-10MB
- Documents: 20MB
- JSON requests: 1MB
- Text fields: 10,000-50,000 characters

---

## 4. Error Handling

**Impact: MEDIUM-HIGH**

Proper error handling provides clear feedback to clients and prevents information leakage.

### 4.1 Use HTTPException with Proper Status Codes

**Impact: HIGH (clear error communication)**

Always use appropriate HTTP status codes and provide clear, actionable error messages.

**Common status codes:**

```python
from fastapi import HTTPException

# 400 Bad Request - Client error (invalid input)
raise HTTPException(
    status_code=400,
    detail="Invalid file type. Supported types: .pdf, .docx, .pptx"
)

# 401 Unauthorized - Authentication required or failed
raise HTTPException(
    status_code=401,
    detail="Invalid or expired session"
)

# 403 Forbidden - Authenticated but not authorized
raise HTTPException(
    status_code=403,
    detail="Insufficient permissions to access this resource"
)

# 404 Not Found - Resource doesn't exist
raise HTTPException(
    status_code=404,
    detail="Conversation not found"
)

# 429 Too Many Requests - Rate limit exceeded
raise HTTPException(
    status_code=429,
    detail="Rate limit exceeded. Please try again later."
)

# 500 Internal Server Error - Server-side error
raise HTTPException(
    status_code=500,
    detail="An unexpected error occurred. Please try again."
)

# 503 Service Unavailable - Service temporarily unavailable
raise HTTPException(
    status_code=503,
    detail="RAG functionality is not available in this deployment"
)
```

**Best practices:**

- Use 4xx for client errors (bad input, auth failures)
- Use 5xx for server errors (bugs, external service failures)
- Provide actionable error messages
- Don't expose internal implementation details
- Be consistent across your API

### 4.2 Return Clear Validation Error Messages

**Impact: MEDIUM (improves developer experience)**

Pydantic automatically generates validation errors, but you can customize them for clarity.

**Default Pydantic errors are good:**

```python
# When client sends invalid data, Pydantic returns:
{
    "detail": [
        {
            "loc": ["body", "user_message"],
            "msg": "User message is too long (max 10,000 characters)",
            "type": "value_error"
        }
    ]
}
```

**Custom error handler for consistency:**

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Custom handler for validation errors"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"][1:]),  # Skip 'body'
            "message": error["msg"],
            "type": error["type"]
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors}
    )
```

### 4.3 Log Errors with Context, Not Sensitive Data

**Impact: HIGH (debugging without security risks)**

Log errors with enough context for debugging, but never log sensitive data like API keys, passwords, or personal information.

**Incorrect: logs sensitive data**

```python
try:
    result = process_request(api_key=api_key, user_data=user_data)
except Exception as e:
    print(f"Error processing request: {e}")
    print(f"API key: {api_key}")  # Never log this!
    print(f"User data: {user_data}")  # May contain PII!
    raise
```

**Correct: logs context without sensitive data**

```python
import logging

logger = logging.getLogger(__name__)

try:
    result = process_request(api_key=api_key, user_data=user_data)
except Exception as e:
    # Log error with context but no sensitive data
    logger.error(
        f"Error processing request: {str(e)}",
        extra={
            "endpoint": "/api/chat",
            "has_api_key": api_key is not None,
            "user_id": user_data.get("id"),  # ID is OK, not PII
            "error_type": type(e).__name__
        }
    )
    raise HTTPException(status_code=500, detail="An error occurred")
```

**What to log:**

- Error type and message
- Endpoint/function name
- Request ID or correlation ID
- Whether optional fields were provided (not their values)
- Non-sensitive identifiers (user ID, session ID)

**What NOT to log:**

- API keys, passwords, tokens
- Email addresses, phone numbers
- Credit card numbers
- Full request/response bodies (may contain PII)
- Stack traces in production (can expose code structure)

### 4.4 Use Custom Exception Handlers for Consistency

**Impact: MEDIUM (consistent error responses)**

Create custom exception handlers to ensure consistent error response format across your API.

**Example:**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

class APIError(Exception):
    """Base exception for API errors"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "path": str(request.url),
            "method": request.method
        }
    )

# Usage in endpoints
@app.post("/api/chat")
async def chat(chat_request: ChatRequest):
    if not validate_input(chat_request):
        raise APIError("Invalid input", status_code=400)
```

### 4.5 Wrap External Calls in Try-Catch Blocks

**Impact: HIGH (prevents unhandled exceptions)**

Always wrap calls to external services (databases, APIs, file systems) in try-catch blocks to handle failures gracefully.

**Correct pattern:**

```python
@app.post("/api/chat")
async def chat(chat_request: ChatRequest, session: dict = Depends(get_current_session)):
    try:
        # External API call
        stream = create_openai_request(
            api_key=session["api_key"],
            model=chat_request.model,
            messages=messages
        )

        return StreamingResponse(stream, media_type="text/plain")

    except OpenAIError as e:
        # Handle specific OpenAI errors
        logger.error(f"OpenAI API error: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail="Error communicating with AI service"
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Unexpected error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred"
        )
```

**Best practices:**

- Catch specific exceptions first, then general `Exception`
- Log errors with context
- Return appropriate HTTP status codes
- Don't expose internal error details to clients
- Consider retry logic for transient failures

---

## 5. File & Image Processing

**Impact: MEDIUM**

Proper file handling prevents security vulnerabilities and resource exhaustion.

### 5.1 Validate File Size Before Processing

**Impact: CRITICAL (prevents resource exhaustion)**

Always validate file size before reading the entire file into memory or processing it.

**Correct pattern:**

```python
@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    # Read file content
    file_content = await file.read()

    # Validate size immediately
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size too large (max {MAX_FILE_SIZE // (1024 * 1024)}MB)"
        )

    # Now safe to process
    # ...
```

**For streaming large files:**

```python
async def validate_file_size_streaming(file: UploadFile, max_size: int):
    """Validate file size while streaming"""
    total_size = 0
    chunks = []

    while True:
        chunk = await file.read(8192)  # Read in 8KB chunks
        if not chunk:
            break

        total_size += len(chunk)
        if total_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum of {max_size // (1024 * 1024)}MB"
            )
        chunks.append(chunk)

    return b''.join(chunks)
```

### 5.2 Always Clean Up Temporary Files

**Impact: HIGH (prevents disk space exhaustion)**

Always clean up temporary files, even if an error occurs. Use try-finally or context managers.

**Incorrect: file not cleaned up on error**

```python
@app.post("/api/upload")
async def upload_document(file: UploadFile):
    # Create temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
        temp_file.write(await file.read())
        temp_file_path = temp_file.name

    # Process file (may raise exception)
    result = process_document(temp_file_path)

    # Only cleaned up if no exception
    os.unlink(temp_file_path)
    return result
```

**Correct: guaranteed cleanup**

```python
@app.post("/api/upload")
async def upload_document(file: UploadFile):
    # Create temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
        temp_file.write(await file.read())
        temp_file_path = temp_file.name

    try:
        # Process file
        result = process_document(temp_file_path)
        return result
    finally:
        # Always clean up, even on error
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
```

**Better: use context manager**

```python
from contextlib import contextmanager

@contextmanager
def temp_file_context(suffix: str):
    """Context manager for temporary files"""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        yield temp_file.name
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

@app.post("/api/upload")
async def upload_document(file: UploadFile):
    with temp_file_context(suffix='.pdf') as temp_path:
        # Write file
        with open(temp_path, 'wb') as f:
            f.write(await file.read())

        # Process file
        result = process_document(temp_path)
        return result
    # File automatically cleaned up
```

### 5.3 Verify Content Type, Not Just Extension

**Impact: HIGH (prevents malicious uploads)**

Always verify the actual file content type using magic numbers or content inspection, not just the file extension.

**Basic verification:**

```python
import magic  # python-magic library

@app.post("/api/upload")
async def upload_document(file: UploadFile):
    # Read file content
    file_content = await file.read()

    # Verify actual content type using magic numbers
    mime_type = magic.from_buffer(file_content, mime=True)

    allowed_types = {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    }

    if mime_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Detected: {mime_type}"
        )

    # Process file...
```

**Without external library (basic check):**

```python
def verify_pdf_header(content: bytes) -> bool:
    """Verify PDF file by checking magic number"""
    return content.startswith(b'%PDF-')

def verify_docx_header(content: bytes) -> bool:
    """Verify DOCX file by checking magic number (ZIP format)"""
    return content.startswith(b'PK\x03\x04')

@app.post("/api/upload")
async def upload_document(file: UploadFile):
    file_content = await file.read()

    # Verify based on extension
    ext = file.filename.lower().split('.')[-1]

    if ext == 'pdf' and not verify_pdf_header(file_content):
        raise HTTPException(status_code=400, detail="Invalid PDF file")
    elif ext in ['docx', 'pptx'] and not verify_docx_header(file_content):
        raise HTTPException(status_code=400, detail="Invalid Office document")

    # Process file...
```

### 5.4 Use Async for I/O-Bound File Operations

**Impact: MEDIUM (better concurrency)**

Use async file operations for better concurrency when handling multiple file uploads.

**Correct pattern:**

```python
import aiofiles

@app.post("/api/upload")
async def upload_document(file: UploadFile):
    # Async file read
    file_content = await file.read()

    # Async file write
    temp_path = f"/tmp/{file.filename}"
    async with aiofiles.open(temp_path, 'wb') as f:
        await f.write(file_content)

    try:
        # Process file
        result = await process_document_async(temp_path)
        return result
    finally:
        # Async cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)
```

### 5.5 Use StreamingResponse for Large Files

**Impact: MEDIUM (reduces memory usage)**

Use `StreamingResponse` for serving large files to avoid loading them entirely into memory.

**Correct pattern:**

```python
from fastapi.responses import StreamingResponse
import aiofiles

@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    file_path = get_file_path(file_id)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    async def file_iterator():
        async with aiofiles.open(file_path, 'rb') as f:
            while chunk := await f.read(8192):  # 8KB chunks
                yield chunk

    return StreamingResponse(
        file_iterator(),
        media_type='application/octet-stream',
        headers={
            'Content-Disposition': f'attachment; filename="{os.path.basename(file_path)}"'
        }
    )
```

---

## 6. Performance & Optimization

**Impact: MEDIUM**

Performance optimizations improve response times and resource utilization.

### 6.1 Use async def for I/O-Bound Endpoints

**Impact: HIGH (better concurrency)**

Use `async def` for endpoints that perform I/O operations (database queries, API calls, file operations) to allow concurrent request handling.

**Correct pattern:**

```python
# I/O-bound: use async def
@app.post("/api/chat")
async def chat(chat_request: ChatRequest):
    # Async I/O operations
    stream = await create_openai_request(...)
    return StreamingResponse(stream)

# CPU-bound: use regular def
@app.post("/api/process")
def process_data(data: ProcessRequest):
    # CPU-intensive computation
    result = heavy_computation(data)
    return result
```

**When to use async:**

- Database queries
- External API calls
- File I/O operations
- Network requests
- Any operation that waits for I/O

**When NOT to use async:**

- Pure CPU-bound computations
- Simple data transformations
- Synchronous library calls

### 6.2 Use FastAPI Dependencies for Reusable Logic

**Impact: MEDIUM (code reusability and testability)**

Use FastAPI's dependency injection system for reusable logic like authentication, database connections, and common validations.

**Correct pattern:**

```python
from fastapi import Depends, Header, HTTPException

# Define reusable dependency
async def get_current_session(
    x_session_id: str = Header(..., alias="X-Session-ID")
) -> dict:
    """Dependency to validate and return current session"""
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return session

# Use in multiple endpoints
@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    session: dict = Depends(get_current_session)
):
    # Session is already validated
    api_key = session.get("api_key")
    # ...

@app.post("/api/upload")
async def upload(
    file: UploadFile,
    session: dict = Depends(get_current_session)
):
    # Same validation, no code duplication
    # ...
```

**Benefits:**

- Reduces code duplication
- Easier to test (can mock dependencies)
- Clearer separation of concerns
- Automatic OpenAPI documentation

### 6.3 Cache Expensive Computations

**Impact: MEDIUM-HIGH (reduces redundant work)**

Cache results of expensive computations to avoid redundant work.

**Using functools.lru_cache:**

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def get_model_config(model_name: str) -> dict:
    """Cache model configurations"""
    # Expensive lookup or computation
    return load_model_config(model_name)

@app.post("/api/chat")
async def chat(chat_request: ChatRequest):
    # Cached on subsequent calls with same model
    config = get_model_config(chat_request.model)
    # ...
```

**Using custom cache with TTL:**

```python
from datetime import datetime, timedelta
from typing import Optional

class CacheEntry:
    def __init__(self, value, ttl_seconds: int = 300):
        self.value = value
        self.expires_at = datetime.now() + timedelta(seconds=ttl_seconds)

    def is_expired(self) -> bool:
        return datetime.now() > self.expires_at

cache: dict[str, CacheEntry] = {}

def get_cached_or_compute(key: str, compute_fn, ttl: int = 300):
    """Get from cache or compute and cache"""
    if key in cache and not cache[key].is_expired():
        return cache[key].value

    value = compute_fn()
    cache[key] = CacheEntry(value, ttl)
    return value

@app.get("/api/config")
async def get_config():
    return get_cached_or_compute(
        "app_config",
        lambda: fetch_config_from_db(),
        ttl=60  # Cache for 1 minute
    )
```

### 6.4 Use Connection Pooling for Databases

**Impact: HIGH (reduces connection overhead)**

Use connection pooling to reuse database connections instead of creating new ones for each request.

**Example with SQLAlchemy:**

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

# Create engine with connection pool
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,  # Number of connections to maintain
    max_overflow=20,  # Additional connections when pool is full
    pool_timeout=30,  # Seconds to wait for connection
    pool_recycle=3600  # Recycle connections after 1 hour
)

# Use in endpoints
@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    with engine.connect() as conn:
        result = conn.execute(f"SELECT * FROM users WHERE id = {user_id}")
        return result.fetchone()
```

### 6.5 Lazy Import Heavy Dependencies

**Impact: MEDIUM (faster startup time)**

Import heavy dependencies only when needed to reduce startup time and memory usage.

**Incorrect: imports everything at startup**

```python
# At top of file
from transformers import AutoModel, AutoTokenizer
import torch
import tensorflow as tf

@app.post("/api/process")
async def process(data: ProcessRequest):
    if data.use_ml:
        # Heavy imports already loaded even if not used
        model = AutoModel.from_pretrained("model-name")
        # ...
```

**Correct: lazy import**

```python
@app.post("/api/process")
async def process(data: ProcessRequest):
    if data.use_ml:
        # Import only when needed
        from transformers import AutoModel, AutoTokenizer
        model = AutoModel.from_pretrained("model-name")
        # ...
```

---

## 7. Testing Patterns

**Impact: MEDIUM**

Comprehensive testing ensures code quality and prevents regressions.

### 7.1 Use TestClient for Endpoint Testing

**Impact: HIGH (ensures endpoints work correctly)**

Use FastAPI's `TestClient` to test endpoints without running a server.

**Correct pattern:**

```python
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_create_session():
    """Test session creation endpoint"""
    response = client.post(
        "/api/session",
        json={"api_key": "test-key", "provider": "openai"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert data["message"] == "Session created successfully with API key"

def test_create_session_without_key():
    """Test guest session creation"""
    response = client.post(
        "/api/session",
        json={"provider": "openai"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "free turns" in data["message"].lower()

def test_invalid_provider():
    """Test validation error for invalid provider"""
    response = client.post(
        "/api/session",
        json={"provider": "invalid"}
    )

    assert response.status_code == 422  # Validation error
    assert "Invalid provider" in response.text
```

### 7.2 Mock External Dependencies

**Impact: HIGH (reliable, fast tests)**

Mock external dependencies (APIs, databases) to make tests reliable and fast.

**Using unittest.mock:**

```python
from unittest.mock import patch, MagicMock
import pytest

@patch('app.create_openai_request')
def test_chat_endpoint(mock_openai):
    """Test chat endpoint with mocked OpenAI"""
    # Setup mock
    mock_stream = MagicMock()
    mock_stream.__iter__ = lambda self: iter(["Hello", " world"])
    mock_openai.return_value = mock_stream

    # Test endpoint
    response = client.post(
        "/api/chat",
        json={
            "user_message": "Hello",
            "developer_message": "You are helpful"
        },
        headers={"X-Session-ID": "test-session"}
    )

    assert response.status_code == 200
    # Verify mock was called correctly
    mock_openai.assert_called_once()

@patch('app.get_session')
def test_invalid_session(mock_get_session):
    """Test endpoint with invalid session"""
    mock_get_session.return_value = None

    response = client.post(
        "/api/chat",
        json={"user_message": "Hello", "developer_message": "System"},
        headers={"X-Session-ID": "invalid"}
    )

    assert response.status_code == 401
    assert "Invalid or expired session" in response.json()["detail"]
```

### 7.3 Use pytest.mark.parametrize for Multiple Cases

**Impact: MEDIUM (comprehensive test coverage)**

Use `pytest.mark.parametrize` to test multiple input cases with the same test logic.

**Correct pattern:**

```python
import pytest

@pytest.mark.parametrize("provider,expected", [
    ("openai", "openai"),
    ("together", "together"),
    ("OPENAI", "openai"),  # Case insensitive
    ("Together", "together"),
    (None, "openai"),  # Default
])
def test_provider_validation(provider, expected):
    """Test provider validation with various inputs"""
    data = {"provider": provider} if provider else {}
    response = client.post("/api/session", json=data)

    assert response.status_code == 200

@pytest.mark.parametrize("provider,status_code", [
    ("invalid", 422),
    ("aws", 422),
    ("", 422),
])
def test_invalid_provider(provider, status_code):
    """Test invalid provider values"""
    response = client.post("/api/session", json={"provider": provider})
    assert response.status_code == status_code

@pytest.mark.parametrize("message,expected_error", [
    ("", "cannot be empty"),
    ("x" * 10001, "too long"),
    (None, "required"),
])
def test_message_validation(message, expected_error):
    """Test message validation"""
    data = {"user_message": message, "developer_message": "System"}
    response = client.post("/api/chat", json=data)

    assert response.status_code == 422
    assert expected_error.lower() in response.text.lower()
```

### 7.4 Use pytest-asyncio for Async Endpoints

**Impact: MEDIUM (test async code properly)**

Use `pytest-asyncio` to test async endpoints and functions.

**Installation:**

```bash
pip install pytest-asyncio
```

**Correct pattern:**

```python
import pytest
from httpx import AsyncClient
from app import app

@pytest.mark.asyncio
async def test_async_endpoint():
    """Test async endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/chat",
            json={"user_message": "Hello", "developer_message": "System"},
            headers={"X-Session-ID": "test-session"}
        )

        assert response.status_code == 200

@pytest.mark.asyncio
async def test_file_upload():
    """Test async file upload"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        files = {"file": ("test.pdf", b"PDF content", "application/pdf")}
        response = await client.post(
            "/api/upload",
            files=files,
            headers={"X-Session-ID": "test-session"}
        )

        assert response.status_code == 200
```

### 7.5 Aim for High Coverage on Critical Paths

**Impact: HIGH (prevents regressions)**

Focus on high test coverage for critical paths: authentication, validation, error handling, and core business logic.

**Measure coverage:**

```bash
pip install pytest-cov
pytest --cov=app --cov-report=html
```

**Priority areas for testing:**

1. **Authentication & Authorization** (100% coverage)
   - Session validation
   - API key handling
   - Permission checks

2. **Input Validation** (100% coverage)
   - All Pydantic validators
   - File upload validation
   - Size limits

3. **Error Handling** (90%+ coverage)
   - HTTPException cases
   - External service failures
   - Edge cases

4. **Core Business Logic** (90%+ coverage)
   - Main endpoint functionality
   - Data transformations
   - State management

5. **Integration Points** (80%+ coverage)
   - External API calls
   - Database operations
   - File I/O

---

## 8. API Design

**Impact: LOW-MEDIUM**

Good API design improves developer experience and maintainability.

### 8.1 Version Your API Endpoints

**Impact: MEDIUM (enables breaking changes)**

Version your API to allow breaking changes without affecting existing clients.

**Correct pattern:**

```python
# Version in path
@app.post("/api/v1/chat")
async def chat_v1(chat_request: ChatRequestV1):
    # Old implementation
    pass

@app.post("/api/v2/chat")
async def chat_v2(chat_request: ChatRequestV2):
    # New implementation with breaking changes
    pass

# Or version in header
@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    api_version: str = Header("1", alias="X-API-Version")
):
    if api_version == "2":
        return handle_v2(chat_request)
    return handle_v1(chat_request)
```

### 8.2 Use Consistent Naming Conventions

**Impact: LOW-MEDIUM (improves developer experience)**

Use consistent naming conventions across your API for better developer experience.

**Best practices:**

```python
# Use plural nouns for collections
@app.get("/api/users")  # Good
@app.get("/api/user")   # Bad

# Use resource IDs in path
@app.get("/api/users/{user_id}")  # Good
@app.get("/api/get-user")         # Bad

# Use HTTP methods semantically
@app.get("/api/users")           # List users
@app.post("/api/users")          # Create user
@app.get("/api/users/{id}")      # Get user
@app.put("/api/users/{id}")      # Update user (full)
@app.patch("/api/users/{id}")    # Update user (partial)
@app.delete("/api/users/{id}")   # Delete user

# Use snake_case for JSON fields
class UserResponse(BaseModel):
    user_id: str        # Good
    first_name: str     # Good
    userId: str         # Bad (camelCase)
    FirstName: str      # Bad (PascalCase)
```

### 8.3 Provide Clear OpenAPI Documentation

**Impact: MEDIUM (improves API usability)**

Use FastAPI's built-in OpenAPI features to provide clear, comprehensive API documentation.

**Correct pattern:**

```python
@app.post(
    "/api/chat",
    response_model=ChatResponse,
    tags=["Chat"],
    summary="Send a chat message",
    description="""
    Send a message to the AI and receive a streaming response.

    Supports:
    - Conversation history via conversation_id
    - Multiple AI models (GPT-5, GPT-5-mini, GPT-5-nano)
    - Image attachments (OpenAI models only)
    - Multiple providers (OpenAI, Together AI)
    """,
    responses={
        200: {"description": "Streaming chat response"},
        401: {"description": "Invalid or expired session"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"}
    }
)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    x_session_id: str = Header(
        ...,
        alias="X-Session-ID",
        description="Session ID for authentication"
    )
):
    """
    Process a chat request and return streaming AI response.

    The response includes custom headers:
    - X-Conversation-ID: ID to continue this conversation
    - X-Free-Turns-Remaining: Remaining free turns for guest users
    """
    # Implementation...
```

**Benefits:**

- Auto-generated interactive docs at `/docs`
- Clear API contracts for clients
- Better developer experience
- Easier client code generation

### 8.4 Implement Pagination for List Endpoints

**Impact: MEDIUM (prevents resource exhaustion)**

Always implement pagination for endpoints that return lists to prevent returning too much data.

**Correct pattern:**

```python
from typing import List

class PaginatedResponse(BaseModel):
    items: List[dict]
    total: int
    page: int
    page_size: int
    has_next: bool

@app.get("/api/conversations", response_model=PaginatedResponse)
async def list_conversations(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)")
):
    """List conversations with pagination"""
    # Calculate offset
    offset = (page - 1) * page_size

    # Get total count
    total = get_conversation_count()

    # Get paginated items
    items = get_conversations(offset=offset, limit=page_size)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=offset + page_size < total
    )
```

**Alternative: cursor-based pagination**

```python
@app.get("/api/conversations")
async def list_conversations(
    cursor: Optional[str] = Query(None, description="Cursor for next page"),
    limit: int = Query(20, ge=1, le=100)
):
    """List conversations with cursor-based pagination"""
    items, next_cursor = get_conversations_cursor(cursor, limit)

    return {
        "items": items,
        "next_cursor": next_cursor,
        "has_next": next_cursor is not None
    }
```

### 8.5 Make POST/PUT Operations Idempotent

**Impact: MEDIUM (prevents duplicate operations)**

Design POST/PUT operations to be idempotent when possible to prevent duplicate operations from retries.

**Correct pattern:**

```python
@app.post("/api/sessions")
async def create_session(
    session_request: SessionRequest,
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key")
):
    """Create session with idempotency support"""
    if idempotency_key:
        # Check if we've already processed this request
        existing = get_session_by_idempotency_key(idempotency_key)
        if existing:
            # Return existing result instead of creating duplicate
            return existing

    # Create new session
    session_id = create_session(
        api_key=session_request.api_key,
        provider=session_request.provider
    )

    if idempotency_key:
        # Store idempotency key mapping
        store_idempotency_key(idempotency_key, session_id)

    return {"session_id": session_id, "message": "Session created"}
```

**For updates:**

```python
@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate):
    """Update user (idempotent by design)"""
    # PUT should be idempotent - same request produces same result
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update user with provided data
    updated_user = update_user_data(user_id, user_data)

    # Multiple identical requests produce same result
    return updated_user
```

---

## References

1. [FastAPI Documentation](https://fastapi.tiangolo.com/)
2. [Pydantic Documentation](https://docs.pydantic.dev/)
3. [Python Type Hints](https://docs.python.org/3/library/typing.html)
4. [OWASP API Security](https://owasp.org/www-project-api-security/)
5. [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
6. [pytest Documentation](https://docs.pytest.org/)
7. [slowapi Rate Limiting](https://github.com/laurentS/slowapi)

---

## Appendix: Common Patterns from This Codebase

### Session Management Pattern

```python
# Session storage (in-memory for this app)
sessions: dict[str, dict] = {}

def create_session(auth_type: str, api_key: Optional[str] = None, **kwargs) -> str:
    """Create a new session"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "auth_type": auth_type,
        "api_key": api_key,
        "created_at": datetime.now(),
        **kwargs
    }
    return session_id

def get_session(session_id: str) -> Optional[dict]:
    """Get session by ID"""
    return sessions.get(session_id)

# Use in endpoints
@app.post("/api/chat")
async def chat(
    chat_request: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID")
):
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    # Use session...
```

### Rate Limiting Pattern

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Apply different limits based on cost
@app.post("/api/chat")
@limiter.limit("10/minute")  # Expensive
async def chat(request: Request, ...):
    pass

@app.get("/api/config")
@limiter.limit("30/minute")  # Cheap
async def get_config(request: Request):
    pass
```

### File Upload Pattern

```python
@app.post("/api/upload")
@limiter.limit("3/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    x_session_id: str = Header(..., alias="X-Session-ID")
):
    # Validate session
    session = get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.lower().split('.')[-1]
    if ext not in ['pdf', 'docx', 'pptx']:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Validate file size
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20MB
        raise HTTPException(status_code=400, detail="File too large")

    # Process with cleanup
    temp_path = f"/tmp/{file.filename}"
    try:
        with open(temp_path, 'wb') as f:
            f.write(content)
        result = process_file(temp_path)
        return result
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
```

### Streaming Response Pattern

```python
@app.post("/api/chat")
async def chat(chat_request: ChatRequest, session: dict = Depends(get_current_session)):
    async def generate():
        try:
            stream = create_openai_request(
                api_key=session["api_key"],
                model=chat_request.model,
                messages=messages,
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield f"\n\nError: {str(e)}"

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={"X-Conversation-ID": conversation_id}
    )
```

---

## Summary

This guide covers the essential patterns for building secure, performant, and maintainable FastAPI applications with Pydantic. Key takeaways:

1. **Security First**: Always validate sessions, sanitize inputs, and never expose sensitive data
2. **Validate Everything**: Use Pydantic validators extensively for data integrity
3. **Handle Errors Gracefully**: Use appropriate status codes and clear error messages
4. **Optimize Performance**: Use async, caching, and connection pooling
5. **Test Thoroughly**: Focus on critical paths with high coverage
6. **Design for Scale**: Implement rate limiting, pagination, and idempotency

Follow these patterns to build production-ready APIs that are secure, reliable, and maintainable.

