"""
Shared OpenAI request helper for chat, RAG, and topic explorer modes.

Provides a unified interface for OpenAI requests that:
- Enables web search for supported GPT-5 models via Responses API
- Supports both streaming and non-streaming responses
- Works with Together.ai provider (no web search)
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

    For GPT-5 models with OpenAI provider, uses Responses API with web search enabled.
    For other models, uses standard Chat Completions API.

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

    # For OpenAI GPT-5 models, use Responses API with web search
    if _supports_web_search(provider, model):
        # Responses API uses a different format
        # Build the input from messages
        input_parts = []
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "system":
                # System messages go in a separate field
                continue
            input_parts.append(content)

        # Get system message if present
        system_messages = [msg for msg in messages if msg.get("role") == "system"]

        # Prepare Responses API request
        response_kwargs = {
            "model": model,
            "input": "\n\n".join(input_parts),
            "tools": [{"type": "web_search"}],
            "tool_choice": "auto",
        }

        # Add system instruction if present
        if system_messages:
            response_kwargs["instructions"] = system_messages[0].get("content", "")

        # Add compatible kwargs
        if "response_format" in kwargs:
            response_kwargs["response_format"] = kwargs["response_format"]
        if "temperature" in kwargs:
            response_kwargs["temperature"] = kwargs["temperature"]
        if "max_tokens" in kwargs:
            response_kwargs["max_completion_tokens"] = kwargs["max_tokens"]

        # Responses API - note: streaming works differently
        if stream:
            # For streaming with Responses API, we need to handle it differently
            # For now, return non-streaming and convert to streaming format
            response = client.responses.create(**response_kwargs)
            # Wrap in a generator that yields the full response
            def response_generator():
                yield response.output_text
            return response_generator()
        else:
            return client.responses.create(**response_kwargs)

    # For non-GPT-5 models or Together.ai, use standard Chat Completions API
    return client.chat.completions.create(
        model=model,
        messages=messages,
        stream=stream,
        **kwargs
    )


def extract_response_content(response: Any, stream: bool = False) -> Union[str, Iterator[str]]:
    """
    Extract content from OpenAI response.

    Args:
        response: Response from create_openai_request
        stream: Whether the response is streaming

    Returns:
        Response content as string or iterator of strings
    """
    # Check if this is a Responses API response
    if hasattr(response, "output_text"):
        # Responses API response
        return response.output_text

    # Chat Completions API response
    if stream:
        # Return the iterator as-is for streaming
        return response
    else:
        # Extract content from non-streaming response
        return response.choices[0].message.content

