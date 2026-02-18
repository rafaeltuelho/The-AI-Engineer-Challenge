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
os.environ["SESSION_TIMEOUT_MINUTES"] = "60"
os.environ["GOOGLE_CLIENT_ID"] = ""  # Disable Google OAuth by default

# Add parent directory to path for imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Now import the app
from app import app, sessions, conversations, create_session, get_session, count_tokens, resolve_api_key, cleanup_inactive_conversations


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


def test_get_session_updates_last_access():
    """Test get_session() updates last_access timestamp."""
    sessions.clear()
    session_id = create_session(auth_type="guest")
    original_time = sessions[session_id]["last_access"]

    # Get session (should update last_access)
    import time
    time.sleep(0.01)  # Small delay to ensure timestamp changes
    session = get_session(session_id)

    assert session is not None
    assert session["last_access"] > original_time


def test_cleanup_inactive_conversations():
    """Test cleanup_inactive_conversations() removes expired sessions."""
    from datetime import timedelta
    sessions.clear()
    conversations.clear()

    # Create a session with old last_access time
    session_id = create_session(auth_type="guest")
    sessions[session_id]["last_access"] = datetime.now(timezone.utc) - timedelta(hours=2)
    conversations[session_id] = {"conv1": {"messages": []}}

    # Run cleanup
    cleanup_inactive_conversations()

    # Verify session and conversations are removed
    assert session_id not in sessions
    assert session_id not in conversations


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

