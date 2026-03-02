"""
Lightweight conversation persistence for Google-authenticated users using Upstash Redis.

Conversations are keyed by SHA-256 hash of the user's email address.
If Redis is not configured (env vars missing), all functions are no-ops
and the app falls back to pure in-memory storage.
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Per-conversation message limit for Redis persistence
MAX_MESSAGES_PER_CONVERSATION = int(os.getenv("MAX_MESSAGES_PER_CONVERSATION", "100"))

# Redis client singleton (None if not configured)
_redis_client = None
_redis_initialized = False


def _get_redis_client():
    """Get or create the Upstash Redis client. Returns None if not configured."""
    global _redis_client, _redis_initialized

    if _redis_initialized:
        return _redis_client

    _redis_initialized = True

    url = os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN")

    if not url or not token:
        logger.info("Upstash Redis not configured — conversation persistence disabled")
        return None

    try:
        from upstash_redis import Redis
        _redis_client = Redis(url=url, token=token)
        logger.info("Upstash Redis connected — conversation persistence enabled")
    except Exception as e:
        logger.warning(f"Failed to initialize Upstash Redis: {e}")
        _redis_client = None

    return _redis_client


def _make_key(email: str) -> str:
    """Create a Redis key from an email address using SHA-256 hash."""
    email_hash = hashlib.sha256(email.lower().strip().encode()).hexdigest()
    return f"convs:{email_hash}"


class _ConversationEncoder(json.JSONEncoder):
    """JSON encoder that handles datetime objects and Pydantic models."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return {"__datetime__": obj.isoformat()}
        # Handle Pydantic BaseModel instances (e.g., Message)
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        return super().default(obj)


def _conversation_decoder(obj: dict) -> Any:
    """JSON object hook that restores datetime objects."""
    if "__datetime__" in obj:
        return datetime.fromisoformat(obj["__datetime__"])
    return obj


def load_conversations(email: str) -> Dict[str, Dict[str, Any]]:
    """Load all conversations for a user from Redis.

    Returns empty dict if Redis is not configured, key doesn't exist, or on error.
    """
    redis = _get_redis_client()
    if not redis:
        return {}

    try:
        key = _make_key(email)
        data = redis.get(key)
        if data is None:
            return {}
        # upstash-redis returns strings directly
        if isinstance(data, str):
            return json.loads(data, object_hook=_conversation_decoder)
        return {}
    except Exception as e:
        logger.warning(f"Failed to load conversations from Redis: {e}")
        return {}


def _trim_conversation_messages(convs: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Trim each conversation's messages to MAX_MESSAGES_PER_CONVERSATION.

    Preserves leading summary messages (prefixed with [CONVERSATION SUMMARY]).
    Operates on a shallow copy to avoid mutating in-memory data.
    """
    from context_manager import SUMMARY_PREFIX

    trimmed = {}
    for conv_id, conv_data in convs.items():
        messages = conv_data.get("messages", [])
        if len(messages) <= MAX_MESSAGES_PER_CONVERSATION:
            trimmed[conv_id] = conv_data
            continue

        # Check if first message is a summary
        first = messages[0]
        content = first.content if hasattr(first, "content") else first.get("content", "")
        has_summary = content.startswith(SUMMARY_PREFIX)

        if has_summary:
            trimmed_msgs = [first] + messages[-(MAX_MESSAGES_PER_CONVERSATION - 1):]
        else:
            trimmed_msgs = messages[-MAX_MESSAGES_PER_CONVERSATION:]

        # Shallow copy conv_data with trimmed messages
        trimmed[conv_id] = {**conv_data, "messages": trimmed_msgs}

    return trimmed


def save_conversations(email: str, convs: Dict[str, Dict[str, Any]]) -> None:
    """Save all conversations for a user to Redis (best-effort).

    Trims each conversation to MAX_MESSAGES_PER_CONVERSATION before saving.
    Logs errors but never raises — in-memory data is the source of truth.
    """
    redis = _get_redis_client()
    if not redis:
        return

    try:
        key = _make_key(email)
        if not convs:
            # Delete key if no conversations to save (save space)
            redis.delete(key)
        else:
            trimmed = _trim_conversation_messages(convs)
            data = json.dumps(trimmed, cls=_ConversationEncoder)
            redis.set(key, data)
    except Exception as e:
        logger.warning(f"Failed to save conversations to Redis: {e}")


def delete_conversations(email: str) -> None:
    """Delete a user's persisted conversations from Redis (best-effort)."""
    redis = _get_redis_client()
    if not redis:
        return

    try:
        key = _make_key(email)
        redis.delete(key)
    except Exception as e:
        logger.warning(f"Failed to delete conversations from Redis: {e}")

