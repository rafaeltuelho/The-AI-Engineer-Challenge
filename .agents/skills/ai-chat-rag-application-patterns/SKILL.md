---
name: ai-chat-rag-application-patterns
description: Comprehensive guide to AI chat and RAG patterns used in this repository. Covers chat endpoints, provider abstraction, document ingestion, retrieval augmentation, vector search, conversation persistence, multimodal attachments, and security/guardrails. Use when implementing or modifying chat functionality, RAG features, provider integrations, conversation management, document processing, or security features in this AI application.
license: MIT
metadata:
  author: augment-solutions
  version: "1.0.0"
---
# AI Chat and RAG Application Patterns

Comprehensive guide to AI chat and RAG patterns used in this repository. Covers chat endpoints, provider abstraction, document ingestion, retrieval augmentation, vector search, conversation persistence, multimodal attachments, and security/guardrails.

## When to Apply

Use this skill when:

- Implementing or modifying chat functionality
- Adding RAG features or document processing
- Integrating new AI providers
- Managing conversation persistence
- Handling multimodal attachments
- Implementing security features or guardrails

---

## Overview

This repository implements a production-ready AI chat application with RAG capabilities, optimized for Vercel deployment. Key characteristics:

- **Lightweight dependencies**: Avoids heavy ML libraries for serverless compatibility
- **Multi-provider support**: OpenAI and Together.ai with unified abstraction
- **Streaming responses**: Real-time chat with FastAPI StreamingResponse
- **Session-based architecture**: Secure session management with Redis persistence
- **Document RAG**: PDF, Word, PowerPoint processing with vector search
- **Multimodal support**: Image attachments for OpenAI GPT models
- **Security-first**: Rate limiting, input validation, API key protection

---

## 1. Chat Endpoint Patterns

### 1.1 Streaming Chat Endpoint

**Location:** `api/app.py` - `/api/chat` endpoint

**Pattern:**
```python
@app.post("/api/chat")
@limiter.limit("10/minute")
async def chat(request: Request, chat_request: ChatRequest, x_session_id: str = Header(...)):
    # 1. Validate session
    session = get_session(session_id)
    
    # 2. Resolve API key (user key > session key > server key)
    api_key, provider = resolve_api_key(session_id, chat_request.api_key, chat_request.provider)
    
    # 3. Get/create conversation
    conversation_id = chat_request.conversation_id or str(uuid.uuid4())
    
    # 4. Build message history for LLM
    messages_for_openai = [{"role": "system", "content": system_msg}]
    for msg in conversation["messages"]:
        messages_for_openai.append({"role": msg.role, "content": msg.content})
    
    # 5. Stream response
    async def generate():
        stream = create_openai_request(
            api_key=api_key,
            provider=provider,
            model=model,
            messages=messages_for_openai,
            stream=True,
            image_data_url=image_data_url
        )
        for chunk in stream:
            # Handle both Responses API and Chat Completions API formats
            yield content
    
    return StreamingResponse(generate(), media_type="text/plain")
```

**Key points:**
- Rate limiting via `@limiter.limit()`
- Session validation via header `X-Session-ID`
- API key resolution with fallback hierarchy
- Streaming via async generator
- Conversation history management
- Support for both Responses API (GPT-5) and Chat Completions API

### 1.2 Message Structure

**Location:** `api/app.py` - `Message` and `ChatRequest` models

**Pattern:**
```python
class Message(BaseModel):
    role: str  # "system", "user", or "assistant"
    content: str
    timestamp: datetime
    image_attachment: Optional[ImageAttachment] = None

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    developer_message: str  # System message
    user_message: str
    model: Optional[str] = "gpt-5-mini"
    api_key: Optional[str] = None
    provider: Optional[str] = "openai"
    image_attachment: Optional[ImageAttachment] = None
```

**Key points:**
- Pydantic models for validation
- Timestamps for all messages
- Optional image attachments
- Flexible API key and provider selection

---

## 2. Provider Abstraction

### 2.1 Unified Provider Interface

**Location:** `api/openai_helper.py` - `create_openai_request()`

**Pattern:**
```python
def create_openai_request(
    api_key: str,
    provider: str,  # "openai" or "together"
    model: str,
    messages: List[Dict[str, str]],
    stream: bool = False,
    image_data_url: Optional[str] = None,
    **kwargs
):
    client = create_openai_client(api_key, provider)
    
    # GPT-5 models use Responses API with web search
    if provider == "openai" and model in ["gpt-5", "gpt-5-mini", "gpt-5-nano"]:
        input_data = _messages_to_responses_input(messages, image_data_url)
        return client.responses.create(
            model=model,
            input=input_data,
            tools=[{"type": "web_search"}],
            stream=stream,
            **kwargs
        )
    else:
        # Other models use Chat Completions API
        return client.chat.completions.create(
            model=model,
            messages=messages,
            stream=stream,
            **kwargs
        )
```

**Key points:**
- Single function handles both providers
- Automatic web search for GPT-5 models via Responses API
- Base URL switching for Together.ai
- Consistent interface regardless of provider
- Streaming support for both APIs

### 2.2 Provider Configuration

**Locations:**
- `aimakerspace/openai_utils/chatmodel.py` - `ChatOpenAI` class
- `aimakerspace/openai_utils/embedding.py` - `EmbeddingModel` class

**Pattern:**
```python
class ChatOpenAI:
    def __init__(self, api_key: str, provider: str = "openai"):
        self.provider = provider.lower()
        self.api_key = api_key
        
        if self.provider == "together":
            self.base_url = "https://api.together.xyz/v1"
        else:
            self.base_url = None  # Default OpenAI
```

**Supported providers:**
- **OpenAI**: GPT-5, GPT-5-mini, GPT-5-nano (with web search), text-embedding-3-small
- **Together.ai**: DeepSeek-V3.1, Llama-3.3-70B-Instruct-Turbo, Alibaba-NLP/gte-modernbert-base (embeddings)

---

## 3. RAG Patterns

### 3.1 Document Ingestion

**Location:** `api/rag_lightweight.py` - `DocumentProcessor` class

**Pattern:**
```python
class DocumentProcessor:
    def process_document(self, file_path: str) -> Dict[str, Any]:
        # 1. Detect file type
        file_type = self._detect_file_type(file_path)
        
        # 2. Extract text (lightweight, no ML)
        if file_type == "pdf":
            text = self._extract_pdf_text(file_path)  # PyPDF2 + pdfplumber
        elif file_type == "docx":
            text = self._extract_docx_text(file_path)  # python-docx
        elif file_type == "pptx":
            text = self._extract_pptx_text(file_path)  # python-pptx
        
        # 3. Create chunks (token-based)
        chunks = self._create_chunks(text_content)
        
        return {
            "full_text": text_content,
            "chunks": chunks,
            "chunk_count": len(chunks),
            "metadata": {...}
        }
```

**Chunking strategy:**
- Token-based chunking using tiktoken
- Default: 1000 tokens per chunk, 200 token overlap
- Preserves sentence boundaries where possible

### 3.2 Vector Search and Retrieval

**Location:** `aimakerspace/vectordatabase.py` - `VectorDatabase` class

**Pattern:**
```python
class VectorDatabase:
    def __init__(self, embedding_model: EmbeddingModel, api_key: str):
        self.embedding_model = embedding_model
        # Uses Qdrant in-memory mode for lightweight deployment
        self.client = QdrantClient(":memory:")

    def insert(self, key: str, vector: List[float], metadata: dict):
        # Store vector with metadata
        self.client.upsert(
            collection_name=self.collection_name,
            points=[PointStruct(id=uuid, vector=vector, payload={...})]
        )

    def search_with_metadata(self, query_text: str, k: int = 5):
        # 1. Generate query embedding
        query_vector = self.embedding_model.get_embedding(query_text)

        # 2. Search using Qdrant
        response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=k,
            with_payload=True
        )

        # 3. Return enriched results with metadata
        return [{"chunk_text": ..., "similarity_score": ..., ...}]
```

**Key points:**
- In-memory Qdrant for serverless compatibility
- Cosine similarity for vector search
- Metadata includes: document_id, chunk_index, chunk_text, file info
- Async embedding generation for batch processing

### 3.3 RAG Query Pattern

**Location:** `api/rag_lightweight.py` - `RAGSystem.query_documents()`

**Pattern:**
```python
async def query_documents(self, query: str, k: int = 3, mode: str = "rag",
                         model_name: str = "gpt-5-mini", system_message: Optional[str] = None):
    # 1. Retrieve relevant chunks
    relevant_chunks = self.search_relevant_chunks(query, k=k)

    # 2. Build context from chunks
    context_parts = [chunk_data.get('chunk_text', '') for chunk_data in relevant_chunks]
    context = "\n\n".join(context_parts)

    # 3. Construct prompt with context
    if mode == "topic-explorer":
        # Educational mode for middle school students
        prompt = f"""Context from uploaded materials:\n{context}\n\nQuestion: {query}"""
    else:
        # Standard RAG mode
        prompt = f"""Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {query}"""

    # 4. Generate response
    response = self.chat_model.run(
        model_name=model_name,
        messages=[
            {"role": "system", "content": system_message or default_system_msg},
            {"role": "user", "content": prompt}
        ]
    )

    return response
```

**RAG modes:**
- **rag**: Standard retrieval-augmented generation
- **topic-explorer**: Educational mode with age-appropriate explanations

---

## 4. Conversation Persistence

### 4.1 Session Management

**Location:** `api/app.py` - Session functions

**Pattern:**
```python
# In-memory sessions with Redis backup
sessions: Dict[str, Dict[str, Any]] = {}

def create_session(auth_type: str, email: str = None, api_key: str = None, provider: str = "openai"):
    session_id = str(uuid.uuid4())

    sessions[session_id] = {
        "auth_type": auth_type,  # "api_key", "google", "guest"
        "email": email,
        "is_whitelisted": email in WHITELISTED_EMAILS,
        "free_turns_used": 0,
        "has_own_api_key": api_key is not None,
        "api_key": api_key,  # NOT persisted to Redis
        "provider": provider,
        "created_at": datetime.now(timezone.utc)
    }

    # Best-effort Redis persistence (non-blocking)
    save_session(session_id, sessions[session_id])

    return session_id

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    # Check in-memory first, fall back to Redis
    if session_id in sessions:
        return sessions[session_id]

    session_data = load_session(session_id)
    if session_data:
        sessions[session_id] = session_data
        return session_data

    return None
```

**Key points:**
- In-memory cache with Redis backup
- API keys never persisted to Redis (security)
- Session-scoped conversations
- Whitelisting support for unlimited usage

### 4.2 Conversation Storage

**Location:** `api/persistence.py` - Redis persistence

**Pattern:**
```python
def save_conversations(email: str, convs: Dict[str, Dict[str, Any]]):
    # 1. Trim to MAX_MESSAGES_PER_CONVERSATION (default: 100)
    trimmed = _trim_conversation_messages(convs)

    # 2. Serialize with custom encoder (handles datetime, Pydantic models)
    data = json.dumps(trimmed, cls=_ConversationEncoder)

    # 3. Store in Redis with hashed email key
    key = f"convs:{sha256(email).hexdigest()}"
    redis.set(key, data)

def load_conversations(email: str) -> Dict[str, Dict[str, Any]]:
    key = f"convs:{sha256(email).hexdigest()}"
    data = redis.get(key)
    return json.loads(data, object_hook=_conversation_decoder)
```

**Conversation structure:**
```python
{
    "conversation_id": {
        "messages": [Message, ...],
        "system_message": str,
        "title": str,
        "created_at": datetime,
        "last_updated": datetime,
        "mode": "regular" | "rag" | "topic-explorer"
    }
}
```

**Key points:**
- Email hashed with SHA-256 for privacy
- Message limit per conversation (prevents unbounded growth)
- Best-effort persistence (never blocks on Redis errors)
- In-memory is source of truth
- Preserves conversation summaries when trimming

---

## 5. Multimodal Support

### 5.1 Image Attachment Validation

**Location:** `api/app.py` - `ImageAttachment` model

**Pattern:**
```python
class ImageAttachment(BaseModel):
    mime_type: str  # "image/png", "image/jpeg", etc.
    data_url: str   # Base64 data URL
    filename: Optional[str] = None

    @field_validator('mime_type')
    @classmethod
    def validate_mime_type(cls, v):
        supported = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]
        if v.lower() not in supported:
            raise ValueError(f'Unsupported image type: {v}')
        return v.lower()

    @field_validator('data_url')
    @classmethod
    def validate_data_url(cls, v):
        # 1. Check format
        if not v.startswith('data:image/') or ';base64,' not in v:
            raise ValueError('Invalid data URL format')

        # 2. Decode and check size
        base64_data = v.split(';base64,', 1)[1]
        decoded = base64.b64decode(base64_data)
        size_mb = len(decoded) / (1024 * 1024)

        if size_mb > MAX_IMAGE_SIZE_MB:  # Default: 3 MB
            raise ValueError(f'Image too large: {size_mb:.2f} MB')

        return v
```

**Key points:**
- Base64 data URLs for client-server transfer
- Size validation before processing
- MIME type validation
- Only supported for OpenAI GPT-5 models

### 5.2 Image Handling in Chat

**Pattern:**
```python
# Frontend sends image as part of ChatRequest
chat_request = ChatRequest(
    user_message="What's in this image?",
    image_attachment=ImageAttachment(
        mime_type="image/png",
        data_url="data:image/png;base64,...",
        filename="screenshot.png"
    )
)

# Backend extracts and passes to Responses API
image_data_url = chat_request.image_attachment.data_url
stream = create_openai_request(
    api_key=api_key,
    provider="openai",
    model="gpt-5-mini",
    messages=messages,
    stream=True,
    image_data_url=image_data_url  # Converted to Responses API format
)
```

**Responses API format:**
```python
# Multimodal input for Responses API
[{
    "role": "user",
    "content": [
        {"type": "input_text", "text": "What's in this image?"},
        {"type": "input_image", "image_url": "data:image/png;base64,..."}
    ]
}]
```

---

## 6. Security and Guardrails

### 6.1 Rate Limiting

**Location:** `api/app.py` - SlowAPI integration

**Pattern:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/chat")
@limiter.limit("10/minute")  # 10 requests per minute per IP
async def chat(...):
    pass

@app.post("/api/upload-document")
@limiter.limit("3/minute")  # Stricter for expensive operations
async def upload_document(...):
    pass
```

**Rate limits:**
- Chat: 10/minute
- RAG query: 20/minute
- Document upload: 3/minute
- Session creation: 10/minute
- Conversation retrieval: 30/minute

### 6.2 API Key Security

**Pattern:**
```python
# API key resolution hierarchy
def resolve_api_key(session_id: str, user_api_key: Optional[str], provider: Optional[str]):
    # Priority 1: User-provided key (highest)
    if user_api_key:
        return user_api_key, provider

    # Priority 2: Session's stored key
    if session.get("has_own_api_key") and session.get("api_key"):
        return session["api_key"], provider

    # Priority 3: Server key (free tier)
    if session["free_turns_used"] >= MAX_FREE_TURNS and not session.get("is_whitelisted"):
        raise HTTPException(403, "Free tier limit reached")

    return SERVER_API_KEY, provider

# API keys NEVER persisted to Redis
def save_session(session_id: str, session_data: dict):
    # Exclude api_key for security
    session_copy = {k: v for k, v in session_data.items() if k != "api_key"}
    redis.set(f"session:{session_id}", json.dumps(session_copy))
```

**Key points:**
- API keys never logged or persisted
- Free tier with turn limits (default: 3 turns)
- Whitelisting for unlimited access
- Token limits for free tier messages (500 tokens)

### 6.3 Input Validation

**Pattern:**
```python
# Pydantic validation
class ChatRequest(BaseModel):
    user_message: str
    model: Optional[str] = "gpt-5-mini"
    provider: Optional[str] = "openai"

    @field_validator('provider')
    @classmethod
    def validate_provider(cls, v):
        allowed = ["openai", "together"]
        if v.lower() not in allowed:
            raise ValueError(f'Invalid provider: {v}')
        return v.lower()

    @model_validator(mode='after')
    def validate_image_attachment(self):
        # Images only for OpenAI GPT models
        if self.image_attachment and self.provider != "openai":
            raise ValueError('Images only supported with OpenAI')
        return self

# File upload validation
async def upload_document(file: UploadFile):
    # 1. File type validation
    ext = file.filename.lower().split('.')[-1]
    if ext not in ['pdf', 'docx', 'pptx']:
        raise HTTPException(400, "Unsupported file type")

    # 2. Size validation
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB
        raise HTTPException(400, "File too large")
```

---

## 7. Context Window Management

### 7.1 Conversation Summarization

**Location:** `api/context_manager.py`

**Pattern:**
```python
async def compress_conversation_history(
    messages: List[Message],
    max_tokens: int,
    api_key: str,
    provider: str = "openai"
):
    # 1. Count tokens in conversation
    total_tokens = sum(count_tokens(msg.content, model) for msg in messages)

    # 2. If under limit, return as-is
    if total_tokens <= max_tokens:
        return messages

    # 3. Generate summary of older messages
    messages_to_summarize = messages[:-10]  # Keep recent 10
    summary_prompt = "Summarize this conversation concisely..."

    summary = await generate_summary(messages_to_summarize, api_key, provider)

    # 4. Return summary + recent messages
    summary_message = Message(
        role="system",
        content=f"[CONVERSATION SUMMARY] {summary}",
        timestamp=datetime.now(timezone.utc)
    )

    return [summary_message] + messages[-10:]
```

**Key points:**
- Automatic compression when approaching token limits
- Preserves recent messages for context
- Summary prefixed with `[CONVERSATION SUMMARY]`
- Summaries preserved when trimming for Redis

---

## 8. Testing Patterns

### 8.1 Mocking Providers

**Location:** `api/tests/test_app.py`

**Pattern:**
```python
from unittest.mock import patch, MagicMock

def test_chat_with_together_provider():
    with patch('openai_helper.OpenAI') as mock_openai:
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        # Mock streaming response
        mock_client.chat.completions.create.return_value = iter([
            MagicMock(choices=[MagicMock(delta=MagicMock(content="Hello"))])
        ])

        # Test endpoint
        response = client.post("/api/chat", json={
            "user_message": "Hi",
            "provider": "together"
        })

        # Verify Together.ai base URL was used
        assert mock_openai.call_args[1]["base_url"] == "https://api.together.xyz/v1"
```

---

## 9. Common Patterns Summary

### When implementing chat features:
1. Use `create_openai_request()` for provider abstraction
2. Always validate session with `get_session()`
3. Resolve API keys with `resolve_api_key()`
4. Use streaming for real-time responses
5. Persist conversations asynchronously (non-blocking)

### When implementing RAG features:
1. Use `DocumentProcessor` for lightweight text extraction
2. Chunk with token-based strategy (1000 tokens, 200 overlap)
3. Store in Qdrant with rich metadata
4. Retrieve with `search_with_metadata()` for context
5. Inject context into prompts clearly

### When adding security:
1. Apply rate limiting with `@limiter.limit()`
2. Validate all inputs with Pydantic
3. Never persist API keys
4. Check free tier limits before processing
5. Validate file types and sizes

### When handling multimodal:
1. Validate image format and size
2. Use base64 data URLs for transfer
3. Only support for OpenAI GPT models
4. Convert to Responses API format
5. Store image metadata in conversation history

---

## 10. Environment Variables

```bash
# API Keys
OPENAI_API_KEY=sk-...
TOGETHER_API_KEY=...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Free Tier
MAX_FREE_TURNS=3
MAX_FREE_MESSAGE_TOKENS=500
FREE_PROVIDER=together
FREE_MODEL=deepseek-ai/DeepSeek-V3.1

# Whitelisting
WHITELISTED_EMAILS=user1@example.com,user2@example.com

# Image Upload
MAX_IMAGE_SIZE_MB=3

# Conversation Persistence
MAX_MESSAGES_PER_CONVERSATION=100
```

---

## References

- **Chat endpoints**: `api/app.py` - `/api/chat`, `/api/rag-query`
- **Provider abstraction**: `api/openai_helper.py`
- **RAG system**: `api/rag_lightweight.py`
- **Vector database**: `aimakerspace/vectordatabase.py`
- **Persistence**: `api/persistence.py`
- **Context management**: `api/context_manager.py`
- **Tests**: `api/tests/test_app.py`


