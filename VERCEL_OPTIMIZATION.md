# Vercel Free Tier Optimization Guide

## Problem
Your build was exceeding Vercel's 250MB serverless function size limit due to heavy development and optional dependencies.

## Solution Implemented

### 1. **Removed Development Dependencies**
- ❌ `jupyter` (~50MB)
- ❌ `ipykernel` (~30MB)

These are only needed for local development notebooks, not production.

### 2. **Made RAG Optional**
- ❌ `qdrant-client` (~50MB) - moved to optional
- ❌ `numpy` (~50MB) - moved to optional

RAG (Retrieval-Augmented Generation) is a nice-to-have feature, not core functionality.

### 3. **Dependency Structure**

**Production (always installed):**
```
fastapi, uvicorn, openai, together, pydantic, google-auth,
PyPDF2, pdfplumber, tiktoken, python-docx, python-pptx,
httpx, requests, python-dotenv, slowapi
```

**Optional - Development:**
```
pip install -e ".[dev]"  # Adds: jupyter, ipykernel, numpy
```

**Optional - RAG Features:**
```
pip install -e ".[rag]"  # Adds: qdrant-client, numpy
```

### 4. **Graceful Degradation**
- Core chat functionality works without RAG
- RAG endpoints return 503 with helpful message if dependencies missing
- No breaking changes to existing code

## Deployment Steps

### For Vercel Production:
1. No changes needed - uses production dependencies only
2. Build should now fit within 250MB limit
3. Core chat features fully functional

### For Local Development:
```bash
# Install everything including dev tools
uv sync
# or
pip install -e ".[dev,rag]"
```

### For RAG Features on Vercel:
If you upgrade to Vercel Pro or use a different platform:
```bash
pip install -e ".[rag]"
```

## Expected Size Reduction
- **Before:** ~280-300MB (exceeds limit)
- **After:** ~150-180MB (well within limit)

## Testing
```bash
# Test core chat (should work)
curl -X POST http://localhost:8000/api/chat

# Test RAG (should return 503 on free tier)
curl -X POST http://localhost:8000/api/upload-document
```

## Next Steps
1. Push to Vercel and verify deployment succeeds
2. Test core chat functionality
3. If you need RAG, consider upgrading Vercel plan or using alternative hosting

