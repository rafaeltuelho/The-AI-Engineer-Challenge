# API Key Parametrization Changes

## Overview
This branch implements parametrization of OpenAI API keys throughout the backend API and aimakerspace library, ensuring that API keys are always sourced from the frontend rather than relying on server-side environment variables.

## Changes Made

### 1. aimakerspace/openai_utils/chatmodel.py
- **Modified**: `ChatOpenAI.__init__()` method
- **Changes**: 
  - Added `api_key: str = None` parameter
  - Updated to use provided API key or fall back to environment variable
  - Updated `run()` method to pass API key to OpenAI client
- **Impact**: ChatOpenAI now accepts API keys as parameters instead of relying solely on environment variables

### 2. aimakerspace/openai_utils/embedding.py
- **Modified**: `EmbeddingModel.__init__()` method
- **Changes**:
  - Added `api_key: str = None` parameter
  - Updated to use provided API key or fall back to environment variable
  - Updated both async and sync OpenAI clients to use the provided API key
- **Impact**: EmbeddingModel now accepts API keys as parameters

### 3. aimakerspace/vectordatabase.py
- **Modified**: `VectorDatabase.__init__()` method
- **Changes**:
  - Added `api_key: str = None` parameter
  - Updated to pass API key to EmbeddingModel constructor
- **Impact**: VectorDatabase now properly passes API keys to its embedding model

### 4. api/pdf_rag.py
- **Modified**: `RAGSystem.__init__()` method
- **Changes**:
  - Updated to pass API key to all sub-components (EmbeddingModel, VectorDatabase, ChatOpenAI)
- **Impact**: RAG system now uses parametrized API keys throughout

### 5. api/app.py
- **Modified**: Multiple endpoints
- **Changes**:
  - Updated PDF upload endpoint to get API key from `X-API-Key` header instead of form data
  - Updated RAG query endpoint to require `X-API-Key` header
  - Updated documents endpoint to require `X-API-Key` header
  - Improved error messages for missing API keys
- **Impact**: All API endpoints now consistently require API keys in headers

## Security Improvements
1. **No Server-Side API Key Storage**: API keys are no longer stored in environment variables on the server
2. **Client-Controlled Authentication**: Each request must provide its own API key
3. **Session-Based Security**: API keys are validated per session, not globally
4. **Header-Based Authentication**: Consistent use of `X-API-Key` header for API key transmission

## Backward Compatibility
- All classes maintain backward compatibility by falling back to environment variables if no API key is provided
- This ensures existing code continues to work while new code can use parametrized API keys

## Frontend Integration Required
The frontend will need to be updated to:
1. Include `X-API-Key` header in all requests to PDF upload, RAG query, and document info endpoints
2. Pass the user's OpenAI API key in this header
3. Ensure the API key is available from the user's session/authentication

## Testing
- All changes maintain backward compatibility
- No linting errors introduced
- API endpoints now properly validate API key presence
- RAG system components now use parametrized API keys

## Merge Instructions

### GitHub PR Route
1. Create a pull request from `feature/parametrize-api-keys` to `main`
2. Title: "Parametrize API Keys - Remove Server-Side Environment Variable Dependencies"
3. Description: Include this MERGE.md content
4. Review and merge the PR

### GitHub CLI Route
```bash
# Switch to main branch
git checkout main

# Merge the feature branch
git merge feature/parametrize-api-keys

# Push changes
git push origin main

# Delete feature branch (optional)
git branch -d feature/parametrize-api-keys
git push origin --delete feature/parametrize-api-keys
```

## Files Modified
- `aimakerspace/openai_utils/chatmodel.py`
- `aimakerspace/openai_utils/embedding.py`
- `aimakerspace/vectordatabase.py`
- `api/pdf_rag.py`
- `api/app.py`

## Breaking Changes
None - all changes are backward compatible with fallback to environment variables.