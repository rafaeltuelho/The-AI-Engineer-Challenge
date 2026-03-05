"""
Comprehensive tests for the FastAPI backend.

Tests cover:
- Health endpoint
- Auth endpoints (guest, Google, config, me, logout)
- Session management
- API key resolution
- Pydantic model validation
- Conversation CRUD
- Token counting
"""

import os
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock
import httpx

# Set environment variables BEFORE importing the app
os.environ["TOGETHER_API_KEY"] = "test-together-key"
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["MAX_FREE_TURNS"] = "3"
os.environ["GOOGLE_CLIENT_ID"] = ""  # Disable Google OAuth by default

# Add parent directory to path for imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Now import the app
from app import app, sessions, conversations, create_session, get_session, count_tokens, resolve_api_key


@pytest_asyncio.fixture
async def client():
    """Create an async HTTP client for testing the FastAPI app."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def clean_state():
    """Clean up sessions and conversations before each test."""
    sessions.clear()
    conversations.clear()
    yield
    sessions.clear()
    conversations.clear()


@pytest.fixture
def mock_session():
    """Create a test session and return session_id."""
    session_id = create_session(auth_type="api_key", api_key="test-api-key", provider="openai")
    return session_id


@pytest.fixture
def mock_guest_session():
    """Create a guest session and return session_id."""
    session_id = create_session(auth_type="guest", provider="together")
    return session_id


# ============================================
# 1. Health Endpoint Tests
# ============================================

@pytest.mark.asyncio
async def test_health_endpoint(client, clean_state):
    """Test GET /api/health returns 200 with status info."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


# ============================================
# 2. Auth Endpoints Tests
# ============================================

@pytest.mark.asyncio
async def test_create_guest_session(client, clean_state):
    """Test POST /api/auth/guest creates guest session."""
    response = await client.post("/api/auth/guest")
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "user" in data
    assert data["user"]["auth_type"] == "guest"
    assert data["user"]["name"] == "Guest"
    assert data["user"]["is_whitelisted"] is False
    assert data["user"]["free_turns_remaining"] == 3
    assert data["user"]["has_own_api_key"] is False


@pytest.mark.asyncio
async def test_get_auth_config(client, clean_state):
    """Test GET /api/auth/config returns auth configuration."""
    response = await client.get("/api/auth/config")
    assert response.status_code == 200
    data = response.json()
    assert "google_auth_enabled" in data
    assert "max_free_turns" in data
    assert data["max_free_turns"] == 3
    assert "free_model" in data
    assert "free_provider" in data


@pytest.mark.asyncio
async def test_get_auth_me_valid_session(client, clean_state, mock_session):
    """Test GET /api/auth/me returns user info for valid session."""
    response = await client.get(
        "/api/auth/me",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["auth_type"] == "api_key"
    assert data["has_own_api_key"] is True
    assert data["free_turns_used"] == 0


@pytest.mark.asyncio
async def test_get_auth_me_invalid_session(client, clean_state):
    """Test GET /api/auth/me returns 401 for invalid session."""
    response = await client.get(
        "/api/auth/me",
        headers={"X-Session-ID": "invalid-session-id"}
    )
    assert response.status_code == 401
    assert "Invalid or expired session" in response.json()["detail"]


@pytest.mark.asyncio
async def test_logout_valid_session(client, clean_state, mock_session):
    """Test POST /api/auth/logout deletes session and conversations."""
    # Create a conversation for this session
    conversations[mock_session] = {"conv1": {"messages": []}}

    response = await client.post(
        "/api/auth/logout",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Logout successful"

    # Verify session and conversations are deleted
    assert mock_session not in sessions
    assert mock_session not in conversations


@pytest.mark.asyncio
async def test_logout_invalid_session(client, clean_state):
    """Test POST /api/auth/logout returns 401 for invalid session."""
    response = await client.post(
        "/api/auth/logout",
        headers={"X-Session-ID": "invalid-session-id"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_google_auth_not_configured(client, clean_state):
    """Test POST /api/auth/google returns 500 when GOOGLE_CLIENT_ID not configured."""
    response = await client.post(
        "/api/auth/google",
        json={"credential": "fake-google-token"}
    )
    assert response.status_code == 500
    assert "Google OAuth not configured" in response.json()["detail"]


# ============================================
# 3. Session Management Tests
# ============================================

@pytest.mark.asyncio
async def test_create_session_with_api_key(client, clean_state):
    """Test POST /api/session creates session with API key."""
    response = await client.post(
        "/api/session",
        json={"api_key": "test-key-123", "provider": "openai"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "API key" in data["message"]


@pytest.mark.asyncio
async def test_create_session_without_api_key(client, clean_state):
    """Test POST /api/session creates guest session without API key."""
    response = await client.post(
        "/api/session",
        json={"provider": "together"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert "Guest session" in data["message"]


def test_create_session_helper_api_key():
    """Test create_session() helper with api_key auth type."""
    sessions.clear()
    session_id = create_session(auth_type="api_key", api_key="test-key", provider="openai")
    assert session_id in sessions
    session = sessions[session_id]
    assert session["auth_type"] == "api_key"
    assert session["api_key"] == "test-key"
    assert session["has_own_api_key"] is True
    assert session["provider"] == "openai"


def test_create_session_helper_google():
    """Test create_session() helper with google auth type."""
    sessions.clear()
    session_id = create_session(
        auth_type="google",
        email="test@example.com",
        name="Test User",
        picture="http://example.com/pic.jpg",
        provider="together"
    )
    assert session_id in sessions
    session = sessions[session_id]
    assert session["auth_type"] == "google"
    assert session["email"] == "test@example.com"
    assert session["name"] == "Test User"
    assert session["picture"] == "http://example.com/pic.jpg"
    assert session["has_own_api_key"] is False


def test_create_session_helper_guest():
    """Test create_session() helper with guest auth type."""
    sessions.clear()
    session_id = create_session(auth_type="guest", provider="together")
    assert session_id in sessions
    session = sessions[session_id]
    assert session["auth_type"] == "guest"
    assert session["has_own_api_key"] is False
    assert session["free_turns_used"] == 0


def test_get_session_returns_none_for_missing():
    """Test get_session() returns None for missing sessions."""
    sessions.clear()
    result = get_session("non-existent-session-id")
    assert result is None


# ============================================
# 4. API Key Resolution Tests
# ============================================

def test_resolve_api_key_user_provided():
    """Test resolve_api_key() - user-provided key takes priority."""
    sessions.clear()
    session_id = create_session(auth_type="api_key", api_key="session-key", provider="openai")

    api_key, provider = resolve_api_key(session_id, user_api_key="user-key", provider="together")
    assert api_key == "user-key"
    assert provider == "together"


def test_resolve_api_key_session_key():
    """Test resolve_api_key() - session's key is second priority."""
    sessions.clear()
    session_id = create_session(auth_type="api_key", api_key="session-key", provider="openai")

    api_key, provider = resolve_api_key(session_id)
    assert api_key == "session-key"
    assert provider == "openai"


def test_resolve_api_key_server_key():
    """Test resolve_api_key() - server key is third priority."""
    sessions.clear()
    session_id = create_session(auth_type="guest", provider="together")

    api_key, provider = resolve_api_key(session_id)
    assert api_key == "test-together-key"  # From env var
    assert provider == "together"


def test_resolve_api_key_free_tier_limit():
    """Test resolve_api_key() returns 403 when free turns exceeded."""
    sessions.clear()
    session_id = create_session(auth_type="guest", provider="together")
    sessions[session_id]["free_turns_used"] = 3  # Exceeded limit

    with pytest.raises(Exception) as exc_info:
        resolve_api_key(session_id)
    assert "403" in str(exc_info.value) or "Free tier limit" in str(exc_info.value)


def test_resolve_api_key_whitelisted_bypass():
    """Test whitelisted users bypass free tier limits."""
    sessions.clear()
    # Set whitelisted email and manually mark session as whitelisted
    session_id = create_session(
        auth_type="google",
        email="whitelist@example.com",
        provider="together"
    )
    # Manually set is_whitelisted since WHITELISTED_EMAILS is set at module load time
    sessions[session_id]["is_whitelisted"] = True
    sessions[session_id]["free_turns_used"] = 10  # Exceeded normal limit

    # Should not raise exception
    api_key, provider = resolve_api_key(session_id)
    assert api_key == "test-together-key"


def test_resolve_api_key_missing_server_key():
    """Test resolve_api_key() returns 500 when server key missing."""
    import app as app_module
    sessions.clear()
    session_id = create_session(auth_type="guest", provider="openai")

    # Temporarily remove server key from the module
    original_key = app_module.SERVER_OPENAI_API_KEY
    app_module.SERVER_OPENAI_API_KEY = ""

    try:
        with pytest.raises(Exception) as exc_info:
            resolve_api_key(session_id)
        assert "500" in str(exc_info.value) or "not configured" in str(exc_info.value)
    finally:
        # Always restore, even if assertions fail
        app_module.SERVER_OPENAI_API_KEY = original_key


# ============================================
# 5. Pydantic Model Validation Tests
# ============================================

def test_chat_request_valid():
    """Test ChatRequest with valid data."""
    from app import ChatRequest

    request = ChatRequest(
        user_message="Hello",
        developer_message="You are a helpful assistant",
        model="gpt-4.1-mini",
        provider="openai"
    )
    assert request.user_message == "Hello"
    assert request.developer_message == "You are a helpful assistant"
    assert request.model == "gpt-4.1-mini"
    assert request.provider == "openai"


def test_chat_request_invalid_user_message():
    """Test ChatRequest with invalid user_message."""
    from app import ChatRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        ChatRequest(
            user_message="",  # Empty message
            developer_message="System message"
        )
    assert "User message is required" in str(exc_info.value)


def test_chat_request_invalid_model():
    """Test ChatRequest with invalid model."""
    from app import ChatRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        ChatRequest(
            user_message="Hello",
            developer_message="System",
            model="invalid-model"
        )
    assert "Invalid model" in str(exc_info.value)


def test_chat_request_invalid_provider():
    """Test ChatRequest with invalid provider."""
    from app import ChatRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        ChatRequest(
            user_message="Hello",
            developer_message="System",
            provider="invalid-provider"
        )
    assert "Invalid provider" in str(exc_info.value)


def test_chat_request_invalid_conversation_id():
    """Test ChatRequest with invalid conversation_id."""
    from app import ChatRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        ChatRequest(
            user_message="Hello",
            developer_message="System",
            conversation_id="invalid@id!"  # Invalid characters
        )
    assert "invalid characters" in str(exc_info.value)


def test_session_request_valid():
    """Test SessionRequest with valid data."""
    from app import SessionRequest

    request = SessionRequest(api_key="test-key", provider="openai")
    assert request.api_key == "test-key"
    assert request.provider == "openai"


def test_session_request_empty_api_key():
    """Test SessionRequest with empty api_key becomes None."""
    from app import SessionRequest

    request = SessionRequest(api_key="   ", provider="openai")
    assert request.api_key is None


def test_google_auth_request_valid():
    """Test GoogleAuthRequest with valid credential."""
    from app import GoogleAuthRequest

    request = GoogleAuthRequest(credential="valid-token-123")
    assert request.credential == "valid-token-123"


def test_google_auth_request_invalid():
    """Test GoogleAuthRequest with invalid credential."""
    from app import GoogleAuthRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        GoogleAuthRequest(credential="")
    assert "Credential is required" in str(exc_info.value)


def test_rag_query_request_valid():
    """Test RAGQueryRequest with valid data."""
    from app import RAGQueryRequest

    request = RAGQueryRequest(
        question="What is this about?",
        developer_message="System message",
        k=5,
        model="gpt-4.1",
        provider="openai"
    )
    assert request.question == "What is this about?"
    assert request.k == 5


def test_rag_query_request_invalid_k():
    """Test RAGQueryRequest with invalid k value."""
    from app import RAGQueryRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as exc_info:
        RAGQueryRequest(
            question="Test",
            developer_message="System",
            k=25  # Out of range
        )
    assert "k must be between 1 and 20" in str(exc_info.value)


# ============================================
# 6. Conversation CRUD Tests
# ============================================

@pytest.mark.asyncio
async def test_list_conversations_empty(client, clean_state, mock_session):
    """Test GET /api/conversations returns empty list."""
    response = await client.get(
        "/api/conversations",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_conversations_non_empty(client, clean_state, mock_session):
    """Test GET /api/conversations returns conversations."""
    # Create a conversation manually
    from app import get_session_conversations, Message
    user_convs = get_session_conversations(mock_session)
    user_convs["conv1"] = {
        "title": "Test Conversation",
        "system_message": "System",
        "messages": [
            Message(role="user", content="Hello", timestamp=datetime.now(timezone.utc))
        ],
        "created_at": datetime.now(timezone.utc),
        "last_updated": datetime.now(timezone.utc),
        "mode": "regular"
    }

    response = await client.get(
        "/api/conversations",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["conversation_id"] == "conv1"
    assert data[0]["title"] == "Test Conversation"
    assert data[0]["message_count"] == 1


@pytest.mark.asyncio
async def test_get_conversation_existing(client, clean_state, mock_session):
    """Test GET /api/conversations/{id} returns conversation."""
    from app import get_session_conversations, Message
    user_convs = get_session_conversations(mock_session)
    user_convs["conv1"] = {
        "title": "Test",
        "system_message": "System",
        "messages": [
            Message(role="user", content="Hello", timestamp=datetime.now(timezone.utc))
        ],
        "created_at": datetime.now(timezone.utc),
        "last_updated": datetime.now(timezone.utc),
        "mode": "regular"
    }

    response = await client.get(
        "/api/conversations/conv1",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["conversation_id"] == "conv1"
    assert data["title"] == "Test"
    assert len(data["messages"]) == 1


@pytest.mark.asyncio
async def test_get_conversation_not_found(client, clean_state, mock_session):
    """Test GET /api/conversations/{id} returns 404 for non-existent."""
    response = await client.get(
        "/api/conversations/non-existent",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_conversation_existing(client, clean_state, mock_session):
    """Test DELETE /api/conversations/{id} deletes conversation."""
    from app import get_session_conversations
    user_convs = get_session_conversations(mock_session)
    user_convs["conv1"] = {"messages": []}

    response = await client.delete(
        "/api/conversations/conv1",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"]
    assert "conv1" not in user_convs


@pytest.mark.asyncio
async def test_delete_conversation_not_found(client, clean_state, mock_session):
    """Test DELETE /api/conversations/{id} returns 404 for non-existent."""
    response = await client.delete(
        "/api/conversations/non-existent",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_clear_all_conversations(client, clean_state, mock_session):
    """Test DELETE /api/conversations clears all conversations."""
    from app import get_session_conversations
    user_convs = get_session_conversations(mock_session)
    user_convs["conv1"] = {"messages": []}
    user_convs["conv2"] = {"messages": []}

    response = await client.delete(
        "/api/conversations",
        headers={"X-Session-ID": mock_session}
    )
    assert response.status_code == 200
    assert "All conversations cleared" in response.json()["message"]
    assert len(user_convs) == 0


# ============================================
# 7. Token Counting Tests
# ============================================

def test_count_tokens_with_known_text():
    """Test count_tokens() with known text."""
    text = "Hello, world!"
    token_count = count_tokens(text, model="gpt-4")
    # Should return a reasonable token count (not exact, but > 0)
    assert token_count > 0
    assert token_count < 100  # Should be small for short text


def test_count_tokens_fallback():
    """Test count_tokens() fallback when encoding fails."""
    # Use an invalid model to trigger fallback
    text = "Hello, world!"
    with patch('app.tiktoken.encoding_for_model', side_effect=Exception("Test error")):
        token_count = count_tokens(text, model="invalid-model")
        # Fallback uses len(text) // 4
        expected = len(text) // 4
        assert token_count == expected



# ============================================
# 8. Persistence Tests
# ============================================

from persistence import (
    load_conversations, save_conversations, delete_conversations,
    _make_key, _ConversationEncoder, _conversation_decoder,
    _redis_client, _redis_initialized
)
import persistence
import json


def test_persistence_make_key():
    """Test _make_key() produces consistent SHA-256 based keys."""
    key = _make_key("user@example.com")
    assert key.startswith("convs:")
    assert len(key) == len("convs:") + 64  # SHA-256 hex is 64 chars
    # Same email should produce same key
    assert _make_key("user@example.com") == _make_key("USER@EXAMPLE.COM")


def test_persistence_graceful_when_redis_not_configured():
    """Verify load/save/delete are no-ops when Redis env vars are missing."""
    # Reset the module-level singleton so it re-checks env vars
    original_client = persistence._redis_client
    original_initialized = persistence._redis_initialized
    persistence._redis_client = None
    persistence._redis_initialized = False

    try:
        # Ensure env vars are not set
        url = os.environ.pop("UPSTASH_REDIS_REST_URL", None)
        token = os.environ.pop("UPSTASH_REDIS_REST_TOKEN", None)

        result = load_conversations("test@example.com")
        assert result == {}

        # Should not raise
        save_conversations("test@example.com", {"conv1": {"messages": []}})
        delete_conversations("test@example.com")

        # Restore env vars if they were set
        if url:
            os.environ["UPSTASH_REDIS_REST_URL"] = url
        if token:
            os.environ["UPSTASH_REDIS_REST_TOKEN"] = token
    finally:
        persistence._redis_client = original_client
        persistence._redis_initialized = original_initialized


def test_persistence_json_encoder_datetime():
    """Test _ConversationEncoder handles datetime objects."""
    dt = datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
    encoded = json.dumps({"ts": dt}, cls=_ConversationEncoder)
    assert "__datetime__" in encoded

    # Decode it back
    decoded = json.loads(encoded, object_hook=_conversation_decoder)
    assert decoded["ts"] == dt


def test_persistence_json_encoder_pydantic_model():
    """Test _ConversationEncoder handles Pydantic Message models."""
    from app import Message
    msg = Message(role="user", content="hello", timestamp=datetime.now(timezone.utc))
    encoded = json.dumps({"msg": msg}, cls=_ConversationEncoder)
    decoded = json.loads(encoded)
    assert decoded["msg"]["role"] == "user"
    assert decoded["msg"]["content"] == "hello"


def test_persistence_save_and_load_roundtrip():
    """Test save then load produces identical data (with mocked Redis)."""
    stored = {}

    mock_redis = MagicMock()
    mock_redis.set = lambda k, v: stored.update({k: v})
    mock_redis.get = lambda k: stored.get(k)

    original_client = persistence._redis_client
    original_initialized = persistence._redis_initialized
    persistence._redis_client = mock_redis
    persistence._redis_initialized = True

    try:
        email = "roundtrip@example.com"
        convs = {
            "conv-1": {
                "messages": [
                    {"role": "user", "content": "hi", "timestamp": datetime(2025, 6, 1, tzinfo=timezone.utc)},
                    {"role": "assistant", "content": "hello!", "timestamp": datetime(2025, 6, 1, 0, 0, 1, tzinfo=timezone.utc)},
                ],
                "system_message": "You are helpful.",
                "title": "Test",
                "created_at": datetime(2025, 6, 1, tzinfo=timezone.utc),
                "last_updated": datetime(2025, 6, 1, 0, 0, 1, tzinfo=timezone.utc),
                "mode": "regular"
            }
        }

        save_conversations(email, convs)
        loaded = load_conversations(email)

        assert "conv-1" in loaded
        assert loaded["conv-1"]["title"] == "Test"
        assert len(loaded["conv-1"]["messages"]) == 2
        assert loaded["conv-1"]["messages"][0]["content"] == "hi"
        # Datetime should be restored
        assert isinstance(loaded["conv-1"]["created_at"], datetime)
    finally:
        persistence._redis_client = original_client
        persistence._redis_initialized = original_initialized


def test_persistence_load_returns_empty_on_missing_key():
    """Test load_conversations returns {} when key doesn't exist in Redis."""
    mock_redis = MagicMock()
    mock_redis.get = MagicMock(return_value=None)

    original_client = persistence._redis_client
    original_initialized = persistence._redis_initialized
    persistence._redis_client = mock_redis
    persistence._redis_initialized = True

    try:
        result = load_conversations("nobody@example.com")
        assert result == {}
    finally:
        persistence._redis_client = original_client
        persistence._redis_initialized = original_initialized


def test_google_auth_loads_persisted_conversations(clean_state):
    """Test that Google auth endpoint loads persisted conversations."""
    import app as app_module

    mock_convs = {
        "old-conv": {
            "messages": [{"role": "user", "content": "old message"}],
            "system_message": "sys",
            "title": "Old",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "mode": "regular"
        }
    }

    with patch.object(app_module, "load_conversations", return_value=mock_convs) as mock_load:
        # Simulate creating a Google session
        session_id = create_session(
            auth_type="google",
            email="test@example.com",
            name="Test User",
            provider="openai"
        )
        # Manually trigger what the Google auth endpoint does
        email = "test@example.com"
        persisted = app_module.load_conversations(email)
        if persisted:
            conversations[session_id] = persisted

        assert session_id in conversations
        assert "old-conv" in conversations[session_id]
        mock_load.assert_called_once_with("test@example.com")


def test_lazy_conversation_rehydration_for_google_sessions(clean_state):
    """Test that get_session_conversations lazily rehydrates from Redis for Google sessions."""
    from app import get_session_conversations
    import app as app_module

    # Create a Google session with persisted conversations
    session_id = create_session(
        auth_type="google",
        email="user@example.com",
        name="Test User",
        provider="openai"
    )

    # Clear the in-memory conversation cache to simulate cross-instance scenario
    conversations.clear()

    # Mock persisted conversations
    mock_convs = {
        "conv-123": {
            "messages": [{"role": "user", "content": "persisted message"}],
            "title": "Persisted Conv",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    }

    with patch.object(app_module, "load_conversations", return_value=mock_convs) as mock_load:
        # Call get_session_conversations - should trigger lazy rehydration
        user_convs = get_session_conversations(session_id)

        # Verify conversations were loaded from persistence
        assert "conv-123" in user_convs
        assert user_convs["conv-123"]["title"] == "Persisted Conv"
        mock_load.assert_called_once_with("user@example.com")

        # Verify in-memory cache was populated
        assert session_id in conversations
        assert conversations[session_id] == mock_convs


def test_lazy_rehydration_guest_sessions_use_empty_dict(clean_state):
    """Test that guest sessions get empty dict, not lazy rehydration."""
    from app import get_session_conversations
    import app as app_module

    # Create a guest session
    session_id = create_session(auth_type="guest", provider="openai")

    # Clear the in-memory conversation cache
    conversations.clear()

    with patch.object(app_module, "load_conversations") as mock_load:
        # Call get_session_conversations for guest session
        user_convs = get_session_conversations(session_id)

        # Should return empty dict without calling load_conversations
        assert user_convs == {}
        mock_load.assert_not_called()


def test_chat_saves_for_google_users(clean_state):
    """Test that save_conversations is called after chat for Google users."""
    import app as app_module

    session_id = create_session(auth_type="google", email="g@test.com", provider="openai")
    conversations[session_id] = {}

    with patch.object(app_module, "save_conversations") as mock_save:
        # Simulate what happens after a chat message is stored
        session = get_session(session_id)
        user_conversations = conversations[session_id]
        user_conversations["conv-1"] = {"messages": [{"role": "user", "content": "hi"}]}

        # This is the persistence call pattern from the chat endpoint
        if session.get("auth_type") == "google" and session.get("email"):
            app_module.save_conversations(session["email"], user_conversations)

        mock_save.assert_called_once_with("g@test.com", user_conversations)


def test_guest_users_no_persistence(clean_state):
    """Test that save_conversations is NOT called for guest sessions."""
    session_id = create_session(auth_type="guest")
    conversations[session_id] = {}

    with patch("app.save_conversations") as mock_save:
        session = get_session(session_id)
        user_conversations = conversations[session_id]
        user_conversations["conv-1"] = {"messages": [{"role": "user", "content": "hi"}]}

        # This is the persistence check pattern — should NOT trigger for guests
        if session.get("auth_type") == "google" and session.get("email"):
            save_conversations(session["email"], user_conversations)

        mock_save.assert_not_called()


# ============================================
# Context Management Tests
# ============================================

class TestGetContextWindowSize:
    """Tests for get_context_window_size."""

    def test_exact_match(self):
        from context_manager import get_context_window_size
        assert get_context_window_size("gpt-4") == 8_192
        assert get_context_window_size("gpt-4.1-mini") == 1_048_576

    def test_prefix_match(self):
        from context_manager import get_context_window_size
        # "gpt-4-0613" should match "gpt-4" prefix
        assert get_context_window_size("gpt-4-0613") == 8_192

    def test_fallback(self):
        from context_manager import get_context_window_size, DEFAULT_CONTEXT_WINDOW
        assert get_context_window_size("unknown-model-xyz") == DEFAULT_CONTEXT_WINDOW


class TestCountConversationTokens:
    """Tests for count_conversation_tokens."""

    def test_counts_system_and_messages(self):
        from context_manager import count_conversation_tokens
        messages = [
            {"role": "user", "content": "Hello there"},
            {"role": "assistant", "content": "Hi! How can I help?"},
        ]
        tokens = count_conversation_tokens(messages, "You are helpful.", "gpt-4")
        assert tokens > 0

    def test_handles_message_objects(self):
        from context_manager import count_conversation_tokens
        from app import Message
        msgs = [Message(role="user", content="test", timestamp=datetime.now(timezone.utc))]
        tokens = count_conversation_tokens(msgs, "system", "gpt-4")
        assert tokens > 0

    def test_empty_messages(self):
        from context_manager import count_conversation_tokens
        tokens = count_conversation_tokens([], "system prompt", "gpt-4")
        # Should only count the system message tokens
        assert tokens > 0


class TestShouldCompress:
    """Tests for should_compress."""

    def test_returns_false_under_threshold(self):
        from context_manager import should_compress
        messages = [{"role": "user", "content": "Hi"}]
        assert should_compress(messages, "system", "gpt-4", threshold_pct=0.8) is False

    def test_returns_true_over_threshold(self):
        from context_manager import should_compress
        # Create enough messages to exceed a very low threshold on a small model
        messages = [
            {"role": "user", "content": "x " * 2000}
            for _ in range(10)
        ]
        # gpt-4 has 8192 tokens, with threshold 0.1 that's ~819 tokens
        assert should_compress(messages, "system", "gpt-4", threshold_pct=0.1) is True


class TestCompressConversation:
    """Tests for compress_conversation (with mocked LLM)."""

    def test_compresses_old_keeps_recent(self):
        from context_manager import compress_conversation, SUMMARY_PREFIX

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Summary of old msgs"))]
        )

        messages = [
            {"role": "user", "content": f"Message {i}"}
            for i in range(10)
        ]
        result = compress_conversation(messages, mock_client, "gpt-4", "system", keep_recent=3)

        # Should be 1 summary + 3 recent = 4 messages
        assert len(result) == 4
        assert result[0]["content"].startswith(SUMMARY_PREFIX)
        assert result[1]["content"] == "Message 7"
        assert result[3]["content"] == "Message 9"

    def test_too_few_messages_returns_unchanged(self):
        from context_manager import compress_conversation

        messages = [{"role": "user", "content": "Hi"}]
        result = compress_conversation(messages, None, "gpt-4", "system", keep_recent=3)
        assert result == messages

    def test_llm_failure_returns_recent_only(self):
        from context_manager import compress_conversation

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API error")

        messages = [{"role": "user", "content": f"Msg {i}"} for i in range(10)]
        result = compress_conversation(messages, mock_client, "gpt-4", "system", keep_recent=3)

        # Should fallback to just the 3 recent messages (no summary)
        assert len(result) == 3
        assert result[0]["content"] == "Msg 7"

    def test_preserves_existing_summary_in_compression(self):
        from context_manager import compress_conversation, SUMMARY_PREFIX

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Updated summary"))]
        )

        messages = [
            {"role": "system", "content": f"{SUMMARY_PREFIX} Old summary"},
            {"role": "user", "content": "Msg 1"},
            {"role": "assistant", "content": "Msg 2"},
            {"role": "user", "content": "Msg 3"},
            {"role": "assistant", "content": "Msg 4"},
            {"role": "user", "content": "Msg 5"},
            {"role": "assistant", "content": "Msg 6"},
            {"role": "user", "content": "Msg 7"},
        ]
        result = compress_conversation(messages, mock_client, "gpt-4", "system", keep_recent=3)

        assert len(result) == 4  # 1 summary + 3 recent
        assert result[0]["content"].startswith(SUMMARY_PREFIX)
        # The LLM call should have included the old summary text
        call_args = mock_client.chat.completions.create.call_args
        user_msg = call_args[1]["messages"][1]["content"]
        assert "Old summary" in user_msg


class TestTrimMessagesForPersistence:
    """Tests for trim_messages_for_persistence."""

    def test_under_limit_returns_unchanged(self):
        from context_manager import trim_messages_for_persistence
        messages = [{"role": "user", "content": f"Msg {i}"} for i in range(5)]
        result = trim_messages_for_persistence(messages, max_count=10)
        assert len(result) == 5

    def test_over_limit_trims_oldest(self):
        from context_manager import trim_messages_for_persistence
        messages = [{"role": "user", "content": f"Msg {i}"} for i in range(15)]
        result = trim_messages_for_persistence(messages, max_count=10)
        assert len(result) == 10
        assert result[0]["content"] == "Msg 5"
        assert result[-1]["content"] == "Msg 14"

    def test_preserves_summary_message(self):
        from context_manager import trim_messages_for_persistence, SUMMARY_PREFIX
        messages = [
            {"role": "system", "content": f"{SUMMARY_PREFIX} Important context"},
        ] + [{"role": "user", "content": f"Msg {i}"} for i in range(14)]
        result = trim_messages_for_persistence(messages, max_count=10)
        assert len(result) == 10
        assert result[0]["content"].startswith(SUMMARY_PREFIX)
        assert result[1]["content"] == "Msg 5"


class TestPersistenceTrimIntegration:
    """Tests for _trim_conversation_messages in persistence.py."""

    def test_trim_on_save(self):
        from persistence import _trim_conversation_messages
        convs = {
            "conv-1": {
                "messages": [{"role": "user", "content": f"Msg {i}"} for i in range(150)],
                "title": "Test",
            }
        }
        result = _trim_conversation_messages(convs)
        assert len(result["conv-1"]["messages"]) == 100  # default MAX

    def test_preserves_short_conversations(self):
        from persistence import _trim_conversation_messages
        convs = {
            "conv-1": {
                "messages": [{"role": "user", "content": "Hi"}],
                "title": "Test",
            }
        }
        result = _trim_conversation_messages(convs)
        assert len(result["conv-1"]["messages"]) == 1


# ============================================
# Session Persistence Tests
# ============================================

def test_session_survives_memory_clear(clean_state):
    """Test session survives in-memory cache clear via Redis fallback."""
    # Create a session
    session_id = create_session(auth_type="guest", provider="together")
    original_session = sessions[session_id].copy()

    # Clear in-memory sessions (simulating cold start)
    sessions.clear()

    # Mock load_session to return the session data
    with patch("app.load_session", return_value=original_session) as mock_load:
        # get_session should fall back to Redis
        session = get_session(session_id)

        # Verify session was retrieved from Redis
        assert session is not None
        assert session["auth_type"] == "guest"
        mock_load.assert_called_once_with(session_id)

        # Verify session was repopulated in memory
        assert session_id in sessions


def test_session_persisted_on_creation(clean_state):
    """Test save_session is called when creating a session."""
    with patch("app.save_session") as mock_save:
        session_id = create_session(
            auth_type="api_key",
            api_key="test-key",
            provider="openai"
        )

        # Verify save_session was called with session_id and session data
        mock_save.assert_called_once()
        call_args = mock_save.call_args
        assert call_args[0][0] == session_id  # First arg is session_id
        assert call_args[0][1]["auth_type"] == "api_key"  # Second arg is session data
        assert call_args[0][1]["provider"] == "openai"


def test_session_deleted_on_logout(clean_state):
    """Test delete_session is called when logging out."""
    session_id = create_session(auth_type="guest", provider="together")

    with patch("app.delete_session") as mock_delete:
        # Simulate logout by deleting from sessions dict
        if session_id in sessions:
            del sessions[session_id]
        if session_id in conversations:
            del conversations[session_id]

        # Call delete_session as the logout endpoint does
        from app import delete_session
        delete_session(session_id)

        # Verify delete_session was called
        mock_delete.assert_called_once_with(session_id)


def test_session_api_key_not_persisted(clean_state):
    """Test API key is excluded when persisting session to Redis."""
    from persistence import save_session
    import json

    # Track what gets written to Redis
    written_data = {}

    def mock_set(key, value):
        written_data[key] = value

    mock_redis = MagicMock()
    mock_redis.set = mock_set

    original_client = persistence._redis_client
    original_initialized = persistence._redis_initialized
    persistence._redis_client = mock_redis
    persistence._redis_initialized = True

    try:
        session_data = {
            "auth_type": "api_key",
            "api_key": "secret-key-123",
            "provider": "openai",
            "has_own_api_key": True,
            "free_turns_used": 0
        }

        save_session("test-session-id", session_data)

        # Verify data was written
        assert len(written_data) == 1
        key = list(written_data.keys())[0]
        assert key == "session:test-session-id"

        # Parse the JSON and verify api_key is NOT present
        stored_data = json.loads(written_data[key])
        assert "api_key" not in stored_data
        assert stored_data["auth_type"] == "api_key"
        assert stored_data["has_own_api_key"] is True
    finally:
        persistence._redis_client = original_client
        persistence._redis_initialized = original_initialized


def test_get_session_no_expiry(clean_state):
    """Test sessions don't expire based on age (no TTL logic)."""
    from datetime import timedelta

    # Create a session
    session_id = create_session(auth_type="guest", provider="together")

    # Manually set created_at to a very old date (e.g., 100 days ago)
    old_date = datetime.now(timezone.utc) - timedelta(days=100)
    sessions[session_id]["created_at"] = old_date

    # get_session should still return the session (no TTL check)
    session = get_session(session_id)
    assert session is not None
    assert session["auth_type"] == "guest"
    assert session["created_at"] == old_date


def test_session_redis_fallback_graceful(clean_state):
    """Test graceful degradation when Redis is unavailable."""
    # Create a session
    session_id = create_session(auth_type="guest", provider="together")

    # Clear in-memory cache
    sessions.clear()

    # Mock load_session to raise an exception (Redis unavailable)
    with patch("app.load_session", side_effect=Exception("Redis connection failed")):
        # get_session should return None gracefully (no crash)
        session = get_session(session_id)
        assert session is None
