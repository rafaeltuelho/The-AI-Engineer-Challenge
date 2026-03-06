"""
Shared OpenAI request helper for chat, RAG, and topic explorer modes.

Provides a unified interface for OpenAI requests that:
- Enables web search for supported GPT-5 models via Responses API
- Supports both streaming and non-streaming responses
- Works with Together.ai provider (no web search, uses Chat Completions API)
- Normalizes output for different use cases
"""

from openai import OpenAI
from typing import List, Dict, Any, Optional, Iterator, Union


# GPT-5 models that support web search via Responses API
GPT5_WEB_SEARCH_MODELS = ["gpt-5", "gpt-5-mini", "gpt-5-nano"]


def _supports_web_search(provider: str, model: str) -> bool:
    """Check if the model supports web search."""
    return provider == "openai" and model in GPT5_WEB_SEARCH_MODELS


def create_openai_client(api_key: str, provider: str) -> OpenAI:
    """
    Create an OpenAI client with appropriate configuration.

    Args:
        api_key: API key for the provider
        provider: Provider name ("openai" or "together")

    Returns:
        Configured OpenAI client
    """
    client_kwargs = {"api_key": api_key}
    if provider == "together":
        client_kwargs["base_url"] = "https://api.together.xyz/v1"

    return OpenAI(**client_kwargs)


def _messages_to_responses_input(messages: List[Dict[str, str]]) -> str:
    """
    Convert Chat Completions messages format to Responses API input format.

    The Responses API expects a single input string, so we concatenate the messages.
    For multi-turn conversations, we format them as a conversation history.

    Args:
        messages: List of message dicts with 'role' and 'content'

    Returns:
        Formatted input string for Responses API
    """
    if len(messages) == 1:
        return messages[0]["content"]

    # For multi-turn conversations, format as conversation history
    formatted_parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            formatted_parts.append(f"System: {content}")
        elif role == "user":
            formatted_parts.append(f"User: {content}")
        elif role == "assistant":
            formatted_parts.append(f"Assistant: {content}")

    return "\n\n".join(formatted_parts)


def create_openai_request(
    api_key: str,
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    stream: bool = False,
    **kwargs
) -> Union[Any, Iterator[Any]]:
    """
    Create an OpenAI request with automatic web search support for GPT-5 models.

    For GPT-5 models with OpenAI provider, uses Responses API with web_search tool.
    For other models and Together.ai, uses Chat Completions API without web search.

    Args:
        api_key: API key for the provider
        provider: Provider name ("openai" or "together")
        model: Model name
        messages: List of message dicts with 'role' and 'content'
        stream: Whether to stream the response
        **kwargs: Additional parameters (e.g., response_format, temperature)

    Returns:
        Response object or streaming iterator
    """
    client = create_openai_client(api_key, provider)

    # For OpenAI GPT-5 models, use Responses API with web search tool
    if _supports_web_search(provider, model):
        # Convert messages to Responses API input format
        input_text = _messages_to_responses_input(messages)

        # Build Responses API request parameters
        request_params = {
            "model": model,
            "input": input_text,
            "tools": [{"type": "web_search"}],
            "stream": stream,
            **kwargs
        }

        # Use Responses API for GPT-5 models with web search
        return client.responses.create(**request_params)
    else:
        # For Together.ai and other models, use Chat Completions API
        request_params = {
            "model": model,
            "messages": messages,
            "stream": stream,
            **kwargs
        }

        return client.chat.completions.create(**request_params)


def extract_response_content(response: Any, stream: bool = False) -> Union[str, Iterator[str]]:
    """
    Extract content from OpenAI response.

    Handles both Responses API and Chat Completions API responses.

    Args:
        response: Response from create_openai_request
        stream: Whether the response is streaming

    Returns:
        Response content as string or iterator of strings
    """
    if stream:
        # Return the iterator as-is for streaming
        # The caller will need to handle the specific format (Responses API vs Chat Completions API)
        return response
    else:
        # Check if this is a Responses API response (has output_text attribute)
        if hasattr(response, 'output_text'):
            return response.output_text
        # Otherwise it's a Chat Completions API response
        else:
            return response.choices[0].message.content

