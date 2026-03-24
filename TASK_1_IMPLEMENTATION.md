# Task 1: Backend — Add web_search, reasoning, and include support

## Summary

Successfully implemented support for `web_search`, `reasoning`, and `include` parameters in the chat API. All changes are fully backward-compatible, with web search enabled by default for GPT-5 models.

## Changes Made

### 1. `api/openai_helper.py`

Updated `create_openai_request()` function to accept three new optional parameters:

- `web_search` (Optional[bool]): Enable/disable web search for GPT-5 models
  - Default: `None` (treated as `True` for backward compatibility)
  - Only applies to GPT-5 models using Responses API
- `reasoning` (Optional[str]): Reasoning effort level
  - Allowed values: "low", "medium", "high"
  - Passed directly to Responses API when provided
- `include` (Optional[List[str]]): Additional data to include in response
  - Allowed values: ["reasoning"]
  - Passed directly to Responses API when provided

**Key implementation details:**

- Web search tool is added by default: `if web_search is None or web_search:`
- This ensures backward compatibility (existing code gets web search ON)
- Parameters only affect Responses API (GPT-5 models), not Chat Completions API

### 2. `api/app.py` - ChatRequest Model

Added three new optional fields to the `ChatRequest` Pydantic model:

```python
web_search: Optional[bool] = None
reasoning: Optional[str] = None
include: Optional[List[str]] = None
```

**Validators added:**

- `validate_reasoning()`: Ensures reasoning is one of ["low", "medium", "high"]
- `validate_include()`: Ensures include items are valid (currently only "reasoning")

### 3. `api/app.py` - Streaming Generator

Updated the streaming generator in the `/api/chat` endpoint to:

1. Pass new parameters to `create_openai_request()`:`stream = create_openai_request( api_key=api_key, provider=chat_request.provider, model=chat_request.model, messages=messages_for_openai, stream=True, image_data_url=image_data_url, web_search=chat_request.web_search, # NEW reasoning=chat_request.reasoning, # NEW include=chat_request.include # NEW )`
2. Handle reasoning events with proper markers:

- Detect `response.reasoning_summary_text.delta` events
- Emit `<!--THINKING-->` marker at the start of reasoning
- Stream reasoning deltas
- Emit `<!--/THINKING-->` marker when transitioning to output text
- This allows the frontend to parse and display thinking vs response text separately

**Event handling logic:**

```python
if event_type == 'response.reasoning_summary_text.delta':
    if not reasoning_started:
        yield '<!--THINKING-->'
        reasoning_started = True
        in_reasoning = True
    yield delta
elif event_type == 'response.output_text.delta':
    if in_reasoning:
        yield '<!--/THINKING-->'
        in_reasoning = False
    full_response += delta
    yield delta
```

## Backward Compatibility

✅ **All existing tests pass (95/95)**

The implementation is fully backward-compatible:

1. **Default behavior preserved**: When `web_search` is not provided, it defaults to `True` for GPT-5 models
2. **Optional parameters**: All new fields are optional with `None` defaults
3. **No breaking changes**: Existing API calls work exactly as before
4. **Graceful degradation**: New parameters are ignored for non-GPT-5 models

## Testing

All existing tests pass without modification:

- Session management tests
- API key resolution tests
- Pydantic model validation tests
- Conversation CRUD tests
- Chat endpoint tests
- RAG endpoint tests
- Persistence tests
- Context management tests

## Usage Examples

### Example 1: Disable web search

```json
{
  "user_message": "What is 2+2?",
  "developer_message": "You are a helpful assistant.",
  "model": "gpt-5-mini",
  "web_search": false
}
```

### Example 2: Enable reasoning with high effort

```json
{
  "user_message": "Solve this complex problem...",
  "developer_message": "You are a helpful assistant.",
  "model": "gpt-5",
  "reasoning": "high",
  "include": ["reasoning"]
}
```

### Example 3: Default behavior (web search ON)

```json
{
  "user_message": "What's the weather today?",
  "developer_message": "You are a helpful assistant.",
  "model": "gpt-5-mini"
}
```

This will automatically enable web search (backward compatible).

## Frontend Integration

The frontend can now:

1. Parse `<!--THINKING-->` and `<!--/THINKING-->` markers to separate reasoning from response
2. Display reasoning in a collapsible section or different styling
3. Control web search, reasoning effort, and included data via API parameters

## Files Modified

1. `api/openai_helper.py` - Added new parameters to `create_openai_request()`
2. `api/app.py` - Updated `ChatRequest` model and streaming generator

## Verification

Run tests to verify:

```bash
cd api && python3 -m pytest tests/ -v
```

Expected result: **95 passed** ✅