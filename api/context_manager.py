"""
Conversation context management: compression and trimming.

Provides token-aware conversation compression (summarizing older messages when
approaching the LLM context window) and message trimming for Redis persistence.
"""

import os
import tiktoken
from typing import Any, Dict, List, Optional

# ============================================
# Model Context Window Sizes (tokens)
# ============================================
MODEL_CONTEXT_WINDOWS: Dict[str, int] = {
    # GPT-4.1 family (1M context)
    "gpt-4.1": 1_048_576,
    "gpt-4.1-mini": 1_048_576,
    "gpt-4.1-nano": 1_048_576,
    # GPT-4 family
    "gpt-4": 8_192,
    "gpt-4-turbo": 128_000,
    "gpt-4-turbo-preview": 128_000,
    "gpt-4o": 128_000,
    "gpt-4o-mini": 128_000,
    # GPT-3.5 family
    "gpt-3.5-turbo": 16_385,
    "gpt-3.5-turbo-16k": 16_385,
    # Together.ai / DeepSeek models
    "deepseek-ai/DeepSeek-V3.1": 65_536,
    "deepseek-ai/DeepSeek-V3": 65_536,
    "meta-llama/Llama-3-70b-chat-hf": 8_192,
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": 131_072,
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": 131_072,
}

DEFAULT_CONTEXT_WINDOW = 16_000  # Conservative fallback

# Configurable thresholds
CONTEXT_WINDOW_THRESHOLD_PCT = float(os.getenv("CONTEXT_WINDOW_THRESHOLD_PCT", "0.8"))
KEEP_RECENT_MESSAGES = int(os.getenv("KEEP_RECENT_MESSAGES", "6"))

# Summary marker so we can identify compressed messages
SUMMARY_PREFIX = "[CONVERSATION SUMMARY]"


def _to_dict(msg) -> Dict[str, str]:
    """Normalize a message (Message object or dict) to a plain dict.

    Handles both Pydantic Message objects (with .role/.content attributes)
    and plain dicts loaded from Redis.
    """
    if isinstance(msg, dict):
        return {"role": msg.get("role", "user"), "content": msg.get("content", "")}
    return {"role": getattr(msg, "role", "user"), "content": getattr(msg, "content", "")}


def _count_tokens(text: str, model: str = "gpt-4") -> int:
    """Count tokens in a text string using tiktoken."""
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        return len(text) // 4


def get_context_window_size(model: str) -> int:
    """Get the context window size for a model.

    Checks exact match first, then prefix match, then fallback.
    """
    if model in MODEL_CONTEXT_WINDOWS:
        return MODEL_CONTEXT_WINDOWS[model]
    # Prefix match (e.g., "gpt-4-0613" → "gpt-4")
    for key, size in MODEL_CONTEXT_WINDOWS.items():
        if model.startswith(key):
            return size
    return DEFAULT_CONTEXT_WINDOW


def count_conversation_tokens(messages: List[Any], system_message: str, model: str) -> int:
    """Count total tokens across all messages + system message.

    Args:
        messages: List of Message objects (with .role and .content) or dicts.
        system_message: The system prompt.
        model: Model name for tokenization.

    Returns:
        Total token count.
    """
    total = _count_tokens(system_message, model)
    for msg in messages:
        content = msg.content if hasattr(msg, "content") else msg.get("content", "")
        total += _count_tokens(content, model)
        total += 4  # Per-message overhead (role, delimiters)
    return total


def should_compress(
    messages: List[Any],
    system_message: str,
    model: str,
    threshold_pct: float = None,
) -> bool:
    """Check if conversation needs compression.

    Returns True if total tokens exceed threshold_pct of the model's context window.
    """
    if threshold_pct is None:
        threshold_pct = CONTEXT_WINDOW_THRESHOLD_PCT
    context_window = get_context_window_size(model)
    threshold = int(context_window * threshold_pct)
    total_tokens = count_conversation_tokens(messages, system_message, model)
    return total_tokens > threshold


def compress_conversation(
    messages: List[Any],
    client,
    model: str,
    system_message: str,
    keep_recent: int = None,
) -> List[Dict[str, Any]]:
    """Compress older messages by summarizing them with the LLM.

    Args:
        messages: Full list of conversation messages.
        client: OpenAI client instance.
        model: Model to use for summarization.
        system_message: The conversation's system prompt.
        keep_recent: Number of recent messages to preserve uncompressed.

    Returns:
        Compressed message list: [summary_message, ...recent_messages].
        If compression fails or isn't needed, returns messages unchanged.
    """
    if keep_recent is None:
        keep_recent = KEEP_RECENT_MESSAGES

    if len(messages) <= keep_recent + 1:
        # Not enough messages to compress — normalize to dicts for consistent return type
        return [_to_dict(m) for m in messages]

    # Split: messages to summarize vs. messages to keep
    to_summarize = messages[:-keep_recent]
    to_keep = messages[-keep_recent:]

    # Build the text to summarize
    summary_lines = []
    for msg in to_summarize:
        role = msg.role if hasattr(msg, "role") else msg.get("role", "unknown")
        content = msg.content if hasattr(msg, "content") else msg.get("content", "")
        # If this is already a summary, include it as context
        if content.startswith(SUMMARY_PREFIX):
            summary_lines.append(f"Previous summary: {content[len(SUMMARY_PREFIX):]}")
        else:
            summary_lines.append(f"{role}: {content}")

    conversation_text = "\n".join(summary_lines)

    try:
        summary_response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a conversation summarizer. Condense the following "
                        "conversation into a brief summary that preserves all key facts, "
                        "decisions, names, numbers, and context needed to continue the "
                        "conversation coherently. Be concise but comprehensive. "
                        "Output ONLY the summary, no preamble."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Summarize this conversation:\n\n{conversation_text}",
                },
            ],
            max_tokens=1000,
            stream=False,
        )

        summary_text = summary_response.choices[0].message.content.strip()

        # Create the summary as a dict (will be converted to Message by caller)
        summary_msg = {
            "role": "system",
            "content": f"{SUMMARY_PREFIX} {summary_text}",
        }

        print(
            f"Compressed {len(to_summarize)} messages into summary "
            f"({_count_tokens(summary_text, model)} tokens)"
        )

        return [summary_msg] + [
            {"role": (m.role if hasattr(m, "role") else m.get("role", "user")),
             "content": (m.content if hasattr(m, "content") else m.get("content", ""))}
            for m in to_keep
        ]

    except Exception as e:
        print(f"Conversation compression failed, using recent messages only: {e}")
        # Fallback: just return recent messages (no summary)
        return [
            {"role": (m.role if hasattr(m, "role") else m.get("role", "user")),
             "content": (m.content if hasattr(m, "content") else m.get("content", ""))}
            for m in to_keep
        ]


def trim_messages_for_persistence(
    messages: List[Any], max_count: int = None
) -> List[Any]:
    """Trim messages to a maximum count for Redis persistence.

    Removes oldest messages first, but preserves any leading summary message
    (identified by SUMMARY_PREFIX in content).

    Args:
        messages: List of messages to trim.
        max_count: Maximum number of messages to keep.

    Returns:
        Trimmed list of messages (may be the same list if under limit).
    """
    if max_count is None:
        max_count = int(os.getenv("MAX_MESSAGES_PER_CONVERSATION", "100"))

    if len(messages) <= max_count:
        return messages

    # Check if the first message is a summary
    first = messages[0]
    content = first.content if hasattr(first, "content") else first.get("content", "")
    has_summary = content.startswith(SUMMARY_PREFIX)

    if has_summary:
        # Keep the summary + the most recent (max_count - 1) messages
        return [first] + messages[-(max_count - 1):]
    else:
        # Just keep the most recent max_count messages
        return messages[-max_count:]

