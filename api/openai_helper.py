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


def _messages_to_responses_input(messages: List[Dict[str, str]], image_data_url: Optional[str] = None) -> Union[str, List[Dict[str, Any]]]:
    """
    Convert Chat Completions messages format to Responses API input format.

    The Responses API expects either:
    - A single input string for text-only
    - An array of message objects with 'role' and 'content' for multimodal input

    Args:
        messages: List of message dicts with 'role' and 'content'
        image_data_url: Optional base64 data URL for image attachment (only for current user turn)

    Returns:
        Formatted input string for text-only, or list of message objects for multimodal
    """
    # Build text input from messages
    if len(messages) == 1:
        text_content = messages[0]["content"]
    else:
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
        text_content = "\n\n".join(formatted_parts)

    # If no image, return text only
    if image_data_url is None:
        return text_content

    # For multimodal input, wrap content parts in a message object with role
    # Responses API format: [{"role": "user", "content": [{"type": "input_text", ...}, {"type": "input_image", ...}]}]
    return [
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": text_content},
                {"type": "input_image", "image_url": image_data_url}
            ]
        }
    ]


def create_openai_request(
    api_key: str,
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    stream: bool = False,
    image_data_url: Optional[str] = None,
    web_search: Optional[bool] = None,
    reasoning: Optional[str] = None,
    include: Optional[List[str]] = None,
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
        image_data_url: Optional base64 data URL for image attachment (OpenAI GPT models only)
        web_search: Optional bool to enable/disable web search (default: True for GPT-5 models)
        reasoning: Optional reasoning effort level ("low", "medium", "high")
        include: Optional list of additional data to include in response (e.g., ["reasoning"])
        **kwargs: Additional parameters (e.g., response_format, temperature)

    Returns:
        Response object or streaming iterator
    """
    client = create_openai_client(api_key, provider)

    # For OpenAI GPT-5 models, use Responses API with web search tool
    if _supports_web_search(provider, model):
        # Convert messages to Responses API input format (with optional image)
        input_data = _messages_to_responses_input(messages, image_data_url)

        # Build Responses API request parameters
        request_params = {
            "model": model,
            "input": input_data,
            "stream": stream,
            **kwargs
        }

        # Add web_search tool if enabled (default: True for backward compatibility)
        if web_search is None or web_search:
            request_params["tools"] = [{"type": "web_search"}]

        # Add reasoning parameter if provided
        if reasoning is not None:
            request_params["reasoning"] = reasoning

        # Add include parameter if provided
        if include is not None:
            request_params["include"] = include

        # Use Responses API for GPT-5 models with web search
        return client.responses.create(**request_params)
    else:
        # For Together.ai and other models, use Chat Completions API
        # Note: Image attachments are not supported for Together.ai
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

