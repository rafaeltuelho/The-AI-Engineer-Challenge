# OpenAI Chat API Backend

This is a FastAPI-based backend service that provides a streaming chat interface using OpenAI's API.

## Prerequisites

- Python 3.13 or higher
- uv (Python package manager) - [Install uv](https://docs.astral.sh/uv/getting-started/installation/)
- An OpenAI API key

## Setup

1. Install dependencies using uv:
```bash
# From the project root directory
uv sync
```

2. Activate the virtual environment:
```bash
# uv automatically creates and manages the virtual environment
source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate
```

## Running the Server

1. Make sure you're in the project root directory and have activated the virtual environment:
```bash
# From the project root directory
source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate
```

2. Start the server using uv:
```bash
# Option 1: Run directly with uv
uv run python api/app.py

# Option 2: Run with uvicorn for development
uv run uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on `http://localhost:8000`

## API Endpoints

### Chat Endpoint
- **URL**: `/api/chat`
- **Method**: POST
- **Request Body**:
```json
{
    "developer_message": "string",
    "user_message": "string",
    "model": "gpt-4.1-mini",  // optional
    "api_key": "your-openai-api-key"
}
```
- **Response**: Streaming text response

### Health Check
- **URL**: `/api/health`
- **Method**: GET
- **Response**: `{"status": "ok"}`

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs` - Interactive API documentation with testing capabilities
- **ReDoc**: `http://localhost:8000/redoc` - Clean, responsive API documentation
- **OpenAPI JSON**: `http://localhost:8000/openapi.json` - Raw OpenAPI specification

The API documentation includes detailed information about all endpoints, request/response schemas, and allows you to test the API directly from the browser.

## Development Workflow

### Adding Dependencies
```bash
# Add a new dependency
uv add package-name

# Add a development dependency
uv add --dev package-name

# Add a specific version
uv add "package-name>=1.0.0"
```

### Managing Dependencies
```bash
# Update all dependencies
uv sync --upgrade

# Remove a dependency
uv remove package-name

# Show dependency tree
uv tree
```

### Running Tests and Development Tools
```bash
# Run tests (if you have them)
uv run pytest

# Run linting
uv run ruff check .

# Run formatting
uv run ruff format .
```

## CORS Configuration

The API is configured to accept requests from any origin (`*`). This can be modified in the `app.py` file if you need to restrict access to specific domains.

## Security Features

### Rate Limiting
The API implements rate limiting to prevent abuse:
- `/api/chat`: 10 requests per minute per IP
- `/api/conversations`: 20 requests per minute per IP
- `/api/conversations/{id}`: 30 requests per minute per IP
- DELETE endpoints: 5-10 requests per minute per IP

### Input Validation
All API requests are validated for:
- **API Key Format**: Must start with "sk-", proper length (20-100 chars), valid characters
- **User Messages**: Required, not empty, max 10,000 characters
- **System Messages**: Max 5,000 characters
- **Model Selection**: Whitelist of allowed models only
- **Conversation IDs**: Proper format and length validation

### Error Handling

The API includes comprehensive error handling for:
- Invalid API keys (format validation)
- Invalid input data (validation errors)
- Rate limit exceeded (429 status code)
- OpenAI API errors
- General server errors

All validation errors return detailed error messages to help with debugging. 