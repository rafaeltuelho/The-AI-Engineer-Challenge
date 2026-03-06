"""
Shared OpenAI request helper for chat, RAG, and topic explorer modes.

Provides a unified interface for OpenAI requests that:
- Enables web search for supported GPT-5 models via Chat Completions API
- Supports both streaming and non-streaming responses
- Works with Together.ai provider (no web search)
- Normalizes output for different use cases
"""

from openai import OpenAI
from typing import List, Dict, Any, Optional, Iterator, Union


# GPT-5 models that support web search
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

    For GPT-5 models with OpenAI provider, adds web_search parameter to enable web search.
    For other models, uses standard Chat Completions API without web search.

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

    # Build request parameters
    request_params = {
        "model": model,
        "messages": messages,
        "stream": stream,
        **kwargs
    }

    # For OpenAI GPT-5 models, enable web search
    if _supports_web_search(provider, model):
        request_params["web_search_options"] = {
            "search_context_size": "medium"
        }

    # Use Chat Completions API for all requests
    return client.chat.completions.create(**request_params)


def extract_response_content(response: Any, stream: bool = False) -> Union[str, Iterator[str]]:
    """
    Extract content from OpenAI response.

    Args:
        response: Response from create_openai_request
        stream: Whether the response is streaming

    Returns:
        Response content as string or iterator of strings
    """
    # Chat Completions API response
    if stream:
        # Return the iterator as-is for streaming
        return response
    else:
        # Extract content from non-streaming response
        return response.choices[0].message.content

