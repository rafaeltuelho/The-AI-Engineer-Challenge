# OpenAI Chat API Backend

This is a FastAPI-based backend service that provides a streaming chat interface using OpenAI's API.

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- An OpenAI API key

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

2. Install the required dependencies:
```bash
pip install fastapi uvicorn openai pydantic
```

## Running the Server

1. Make sure you're in the `api` directory:
```bash
cd api
```

2. Start the server:
```bash
python app.py
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
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

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