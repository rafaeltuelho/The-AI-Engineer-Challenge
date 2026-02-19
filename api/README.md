# OpenAI Chat API Backend

This is a FastAPI-based backend service that provides a streaming chat interface using OpenAI's API.

## Prerequisites

- Python 3.13 or higher
- uv (Python package manager) - [Install uv](https://docs.astral.sh/uv/getting-started/installation/)
- A Together.ai API key (required for free chat turns feature)
- An OpenAI API key (optional, for whitelisted users)
- A Google OAuth Client ID (optional, for Google Sign-In)

## Setup

### Production Installation (Vercel-optimized)
```bash
# From the project root directory
uv sync
```

### Development Installation (includes notebooks & tools)
```bash
# Install with development dependencies
uv sync --extra dev
```

### With RAG Features (document processing)
```bash
# Install with RAG/vector database support
uv sync --extra rag
```

### Full Installation (everything)
```bash
# Install all optional dependencies
uv sync --extra dev --extra rag
```

### Activate the virtual environment:
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

### Authentication Endpoints

#### Create Guest Session
- **URL**: `/api/auth/guest`
- **Method**: POST
- **Rate Limit**: 5 requests per minute
- **Request Body**: None
- **Response**:
```json
{
    "session_id": "uuid-string",
    "user_type": "guest",
    "free_turns_remaining": 3
}
```

#### Google OAuth Login
- **URL**: `/api/auth/google`
- **Method**: POST
- **Rate Limit**: 10 requests per minute
- **Request Body**:
```json
{
    "credential": "google-id-token-from-oauth"
}
```
- **Response**:
```json
{
    "session_id": "uuid-string",
    "user_type": "google_whitelisted" | "google_non_whitelisted",
    "email": "user@example.com",
    "name": "User Name",
    "free_turns_remaining": 3 | null
}
```

#### Get Current User Info
- **URL**: `/api/auth/me`
- **Method**: GET
- **Rate Limit**: 30 requests per minute
- **Headers**: `X-Session-ID: your-session-id`
- **Response**:
```json
{
    "session_id": "uuid-string",
    "user_type": "guest" | "google_whitelisted" | "google_non_whitelisted",
    "email": "user@example.com",  // only for Google users
    "name": "User Name",  // only for Google users
    "free_turns_remaining": 3 | null
}
```

#### Logout
- **URL**: `/api/auth/logout`
- **Method**: POST
- **Rate Limit**: 10 requests per minute
- **Headers**: `X-Session-ID: your-session-id`
- **Response**:
```json
{
    "message": "Logged out successfully"
}
```

#### Get Auth Configuration
- **URL**: `/api/auth/config`
- **Method**: GET
- **Rate Limit**: 30 requests per minute
- **Response**:
```json
{
    "googleClientId": "your-client-id.apps.googleusercontent.com" | null,
    "maxFreeTurns": 3
}
```

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

## Environment Variables

The API supports comprehensive configuration via environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID for authentication | — | No (if absent, Google Sign-In is disabled) |
| `WHITELISTED_EMAILS` | Comma-separated list of emails with unlimited access | — | No |
| `OPENAI_API_KEY` | Server-side OpenAI API key for whitelisted users | — | No |
| `TOGETHER_API_KEY` | Server-side Together.ai API key for free turns | — | Yes (for free turns feature) |
| `FREE_PROVIDER` | Provider to use for free chat turns | `together` | No |
| `FREE_MODEL` | Model to use for free chat turns | `deepseek-ai/DeepSeek-V3.1` | No |
| `MAX_FREE_TURNS` | Maximum free chat turns per session | `3` | No |
| `MAX_FREE_MESSAGE_TOKENS` | Maximum input tokens during free turns | `500` | No |
| `SESSION_TIMEOUT_MINUTES` | How long before inactive sessions are cleaned up (minutes) | `60` | No |
| `CLEANUP_INTERVAL_SECONDS` | How often the cleanup scheduler runs (seconds) | `60` | No |

Create a `.env` file in the project root with your configuration:

```env
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com

# Whitelisted emails for unlimited access (optional)
WHITELISTED_EMAILS=admin@example.com,vip@example.com

# API Keys
OPENAI_API_KEY=sk-your-openai-key-here
TOGETHER_API_KEY=your-together-api-key-here

# Free Tier Configuration
FREE_PROVIDER=together
FREE_MODEL=deepseek-ai/DeepSeek-V3.1
MAX_FREE_TURNS=3
MAX_FREE_MESSAGE_TOKENS=500

# Session Management
SESSION_TIMEOUT_MINUTES=60
CLEANUP_INTERVAL_SECONDS=60
```

## Deployment to Vercel

### Setting Up Environment Variables on Vercel

#### Option 1: Using Vercel Dashboard (Recommended for UI)

1. **Go to your Vercel project dashboard**
   - Navigate to https://vercel.com/dashboard
   - Select your project

2. **Go to Settings → Environment Variables**
   - Click on the "Settings" tab
   - Select "Environment Variables" from the left sidebar

3. **Add each environment variable:**
   - Click "Add New"
   - Enter the variable name and value
   - Select which environments it applies to (Production, Preview, Development)
   - Click "Save"

#### Option 2: Using Vercel CLI (Faster)

```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Link your project (if not already linked)
vercel link

# Add environment variables
vercel env add GOOGLE_CLIENT_ID
vercel env add WHITELISTED_EMAILS
vercel env add MAX_FREE_TURNS
vercel env add MAX_FREE_MESSAGE_TOKENS
vercel env add FREE_PROVIDER
vercel env add FREE_MODEL
vercel env add OPENAI_API_KEY
vercel env add TOGETHER_API_KEY
vercel env add SESSION_TIMEOUT_MINUTES
vercel env add CLEANUP_INTERVAL_SECONDS
```

### Environment Variables for Production

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `GOOGLE_CLIENT_ID` | ✅ Yes | `xxx.apps.googleusercontent.com` | Get from Google Cloud Console |
| `WHITELISTED_EMAILS` | ❌ Optional | `admin@example.com,vip@example.com` | Comma-separated, no spaces |
| `OPENAI_API_KEY` | ⚠️ Conditional | `sk-...` | Required if `FREE_PROVIDER=openai` |
| `TOGETHER_API_KEY` | ⚠️ Conditional | `xxx` | Required if `FREE_PROVIDER=together` |
| `MAX_FREE_TURNS` | ❌ Optional | `3` | Default: 3 |
| `MAX_FREE_MESSAGE_TOKENS` | ❌ Optional | `500` | Default: 500 |
| `FREE_PROVIDER` | ❌ Optional | `together` | Default: together |
| `FREE_MODEL` | ❌ Optional | `deepseek-ai/DeepSeek-V3.1` | Default: deepseek-ai/DeepSeek-V3.1 |
| `SESSION_TIMEOUT_MINUTES` | ❌ Optional | `60` | Default: 60 |
| `CLEANUP_INTERVAL_SECONDS` | ❌ Optional | `60` | Default: 60 |

### Verification

After setting variables, you can verify they're deployed:

```bash
# View all environment variables for your project
vercel env list

# Redeploy to apply changes
vercel --prod
```

### Security Best Practices for Vercel Deployment

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Use Vercel's encrypted storage** - All env vars are encrypted at rest
3. **Rotate API keys regularly** - Especially if compromised
4. **Use different keys for different environments** - Consider separate API keys for staging vs production
5. **Don't pass API keys in URLs** - Your backend handles this securely
6. **Keep sensitive data server-side** - API keys are never exposed to the frontend

## Vercel Free Tier Optimization

This API is optimized to run on Vercel's free tier (250MB serverless function limit):

### What's Included (Production)
- ✅ FastAPI, Uvicorn, OpenAI, Together.ai clients
- ✅ Google OAuth authentication
- ✅ Rate limiting and input validation
- ✅ Session management
- ✅ Core chat functionality
- ✅ RAG Features (document upload/query via `qdrant-client`)

### What's Optional
- ❌ **Development Tools** - Jupyter notebooks, IPython kernel (`pip install -e ".[dev]"`)

See [VERCEL_OPTIMIZATION.md](../VERCEL_OPTIMIZATION.md) for detailed optimization info.

## CORS Configuration

The API is configured to accept requests from any origin (`*`). This can be modified in the `app.py` file if you need to restrict access to specific domains.

## Security Features

### Rate Limiting
The API implements rate limiting to prevent abuse:
- `/api/chat`: 10 requests per minute per IP
- `/api/conversations`: 20 requests per minute per IP
- `/api/conversations/{id}`: 30 requests per minute per IP
- `/api/auth/guest`: 5 requests per minute per IP
- `/api/auth/google`: 10 requests per minute per IP
- `/api/auth/me`: 30 requests per minute per IP
- `/api/auth/logout`: 10 requests per minute per IP
- `/api/auth/config`: 30 requests per minute per IP
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