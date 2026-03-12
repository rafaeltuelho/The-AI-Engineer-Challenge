# Agent Guidance: AI Chat and RAG Application Patterns

This document provides agent-specific guidance for working with the AI chat and RAG patterns in this repository.

---

## Quick Start for Agents

### Before Making Changes

1. **Read the SKILL.md** to understand the patterns used in this codebase
2. **Check existing implementations** in the referenced files before creating new code
3. **Use codebase-retrieval** to find related code that might need updates
4. **Verify provider compatibility** - not all features work with all providers

### Common Tasks

#### Adding a New Chat Feature

1. Check if it requires changes to:
   - `ChatRequest` model (for new request parameters)
   - `/api/chat` endpoint (for new processing logic)
   - `create_openai_request()` (for provider-specific handling)
   - Frontend `ChatInterface.tsx` (for UI changes)

2. Consider:
   - Does it work with both OpenAI and Together.ai?
   - Does it need rate limiting?
   - Does it affect conversation persistence?
   - Does it need validation?

3. Update tests in `api/tests/test_app.py`

#### Adding a New Provider

1. Update `create_openai_request()` in `api/openai_helper.py`:
   - Add base URL configuration
   - Handle provider-specific API differences
   - Update model compatibility checks

2. Update validation in models:
   - `ChatRequest.validate_provider()`
   - `RAGQueryRequest.validate_provider()`

3. Update embedding model if needed:
   - `aimakerspace/openai_utils/embedding.py`
   - Choose appropriate embedding model for provider

4. Add tests for new provider

#### Implementing RAG Features

1. For document processing:
   - Use `DocumentProcessor` in `api/rag_lightweight.py`
   - Keep dependencies lightweight (no heavy ML libraries)
   - Support PDF, DOCX, PPTX formats

2. For vector search:
   - Use `VectorDatabase` with Qdrant in-memory mode
   - Store rich metadata with each chunk
   - Use `search_with_metadata()` for retrieval

3. For RAG queries:
   - Use `RAGSystem.query_documents()`
   - Support both "rag" and "topic-explorer" modes
   - Inject context clearly in prompts

#### Adding Security Features

1. Rate limiting:
   - Use `@limiter.limit("N/minute")` decorator
   - Choose appropriate limits based on operation cost
   - Test with multiple IPs

2. Input validation:
   - Add Pydantic validators to request models
   - Validate file types and sizes
   - Check provider compatibility

3. API key handling:
   - Never log or persist API keys
   - Use `resolve_api_key()` for key resolution
   - Respect free tier limits

---

## Critical Patterns to Follow

### 1. Provider Abstraction

**Always use `create_openai_request()` instead of calling OpenAI directly:**

```python
# ✅ CORRECT
from openai_helper import create_openai_request

response = create_openai_request(
    api_key=api_key,
    provider=provider,
    model=model,
    messages=messages,
    stream=True
)

# ❌ WRONG - bypasses abstraction
from openai import OpenAI
client = OpenAI(api_key=api_key)
response = client.chat.completions.create(...)
```

**Why:** The helper automatically handles:
- Base URL switching for Together.ai
- Web search for GPT-5 models via Responses API
- Consistent interface across providers
- Multimodal input formatting

### 2. Session Validation

**Always validate sessions before processing requests:**

```python
# ✅ CORRECT
session = get_session(session_id)
if not session:
    raise HTTPException(status_code=401, detail="Invalid or expired session")

# ❌ WRONG - assumes session exists
session = sessions[session_id]  # KeyError if missing
```

### 3. API Key Resolution

**Use the resolution hierarchy:**

```python
# ✅ CORRECT
api_key, provider = resolve_api_key(session_id, user_api_key, provider)

# ❌ WRONG - doesn't respect hierarchy or check limits
api_key = user_api_key or SERVER_OPENAI_API_KEY
```

### 4. Conversation Persistence

**Persist asynchronously and handle errors gracefully:**

```python
# ✅ CORRECT
if session.get("auth_type") == "google" and session.get("email"):
    asyncio.get_event_loop().run_in_executor(
        None, save_conversations, session["email"], user_conversations
    )

# ❌ WRONG - blocks on Redis errors
save_conversations(session["email"], user_conversations)  # Can raise
```

### 5. Streaming Responses

**Handle both Responses API and Chat Completions API formats:**

```python
# ✅ CORRECT
for chunk in stream:
    if is_responses_api:
        if getattr(chunk, 'type', None) == 'response.output_text.delta':
            delta = getattr(chunk, 'delta', None)
            if delta:
                yield delta
    else:
        choices = getattr(chunk, "choices", None)
        if choices and len(choices) > 0:
            content = getattr(choices[0].delta, "content", None)
            if content:
                yield content

# ❌ WRONG - assumes Chat Completions API only
for chunk in stream:
    yield chunk.choices[0].delta.content  # Fails for Responses API
```

---

## Common Pitfalls

### 1. Image Attachments

**Problem:** Trying to use images with Together.ai or non-GPT models

```python
# ❌ WRONG
ChatRequest(
    provider="together",
    image_attachment=ImageAttachment(...)  # Validation error!
)

# ✅ CORRECT - validate before creating request
if provider == "openai" and model in ["gpt-5", "gpt-5-mini", "gpt-5-nano"]:
    chat_request = ChatRequest(
        provider=provider,
        model=model,
        image_attachment=image
    )
```

### 2. Heavy Dependencies

**Problem:** Adding ML libraries that break Vercel deployment

```python
# ❌ WRONG - heavy dependencies
import torch
import transformers
from sentence_transformers import SentenceTransformer

# ✅ CORRECT - lightweight alternatives
import PyPDF2
import pdfplumber
from docx import Document
import tiktoken
```

### 3. Unbounded Conversation Growth

**Problem:** Not limiting conversation history

```python
# ❌ WRONG - can grow indefinitely
messages_for_openai = [{"role": "system", "content": system_msg}]
for msg in all_messages:  # Could be thousands of messages
    messages_for_openai.append(...)

# ✅ CORRECT - use context management
if len(all_messages) > MAX_CONTEXT_MESSAGES:
    all_messages = await compress_conversation_history(
        all_messages, max_tokens, api_key, provider
    )
```

### 4. Blocking on Redis

**Problem:** Synchronous Redis calls that can timeout

```python
# ❌ WRONG - blocks request
save_conversations(email, conversations)  # Can timeout
return response

# ✅ CORRECT - async, non-blocking
asyncio.get_event_loop().run_in_executor(
    None, save_conversations, email, conversations
)
return response  # Don't wait for Redis
```

---

## Testing Checklist

When implementing new features, verify:

- [ ] Works with both OpenAI and Together.ai (if applicable)
- [ ] Rate limiting is appropriate
- [ ] Input validation is comprehensive
- [ ] Session validation is present
- [ ] API keys are not logged or persisted
- [ ] Free tier limits are respected
- [ ] Conversation persistence is async
- [ ] Streaming responses handle both API formats
- [ ] Tests cover both providers
- [ ] Error handling is graceful
- [ ] File uploads validate type and size
- [ ] Image attachments validate format and size

---

## Code Review Guidelines

When reviewing AI chat/RAG code:

1. **Provider abstraction**: Is `create_openai_request()` used?
2. **Security**: Are API keys protected? Is rate limiting present?
3. **Validation**: Are inputs validated with Pydantic?
4. **Persistence**: Is Redis access async and error-tolerant?
5. **Streaming**: Does it handle both Responses API and Chat Completions API?
6. **Dependencies**: Are they lightweight and Vercel-compatible?
7. **Context management**: Is conversation history bounded?
8. **Testing**: Are both providers tested?

---

## Quick Reference

### Key Files

- **Chat endpoint**: `api/app.py` → `/api/chat`
- **RAG endpoint**: `api/app.py` → `/api/rag-query`
- **Provider helper**: `api/openai_helper.py`
- **RAG system**: `api/rag_lightweight.py`
- **Vector DB**: `aimakerspace/vectordatabase.py`
- **Persistence**: `api/persistence.py`
- **Context mgmt**: `api/context_manager.py`

### Key Functions

- `create_openai_request()` - Provider abstraction
- `resolve_api_key()` - API key resolution
- `get_session()` - Session validation
- `save_conversations()` - Async persistence
- `compress_conversation_history()` - Context management

### Key Models

- `ChatRequest` - Chat endpoint request
- `RAGQueryRequest` - RAG endpoint request
- `Message` - Conversation message
- `ImageAttachment` - Image data

---

## Examples

### Example 1: Adding a New Model

```python
# 1. Update openai_helper.py
GPT5_WEB_SEARCH_MODELS = ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro"]  # Add new model

# 2. Update validation in app.py
openai_models = ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro"]

# 3. Add test
def test_new_model_with_web_search():
    with patch('openai_helper.OpenAI') as mock_openai:
        create_openai_request(
            api_key="test",
            provider="openai",
            model="gpt-5-pro",
            messages=[{"role": "user", "content": "test"}]
        )
        # Verify Responses API was used
        assert mock_openai.return_value.responses.create.called
```

### Example 2: Adding Document Format Support

```python
# 1. Add extraction method to DocumentProcessor
def _extract_txt_text(self, file_path: str) -> str:
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

# 2. Update process_document
if file_type == "txt":
    text_content = self._extract_txt_text(file_path)

# 3. Update validation in upload endpoint
supported_types = ['pdf', 'docx', 'pptx', 'txt']

# 4. Add test
async def test_upload_txt_document():
    # Create test .txt file
    # Upload and verify processing
    pass
```

### Example 3: Adding a New RAG Mode

```python
# 1. Update RAGQueryRequest validation
mode: Optional[str] = "rag"  # "rag", "topic-explorer", "code-assistant"

# 2. Add system message for new mode
if mode == "code-assistant":
    system_message = """You are a coding assistant. Use the code context to help..."""

# 3. Update query_documents to handle new mode
if mode == "code-assistant":
    prompt = f"""Code context:\n{context}\n\nQuestion: {query}"""

# 4. Add test
async def test_rag_code_assistant_mode():
    # Test new mode
    pass
```

---

## Getting Help

If you're unsure about a pattern:

1. Search for similar implementations in the codebase
2. Check the tests for examples
3. Review SKILL.md for pattern documentation
4. Use codebase-retrieval to find related code
5. Ask for clarification if the pattern is unclear

Remember: This codebase prioritizes lightweight dependencies, provider abstraction, and security. When in doubt, follow existing patterns.
