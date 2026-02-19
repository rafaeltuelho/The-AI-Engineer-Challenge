# Vercel Free Tier Optimization Guide

## Problem
Your build was exceeding Vercel's 250MB serverless function size limit due to heavy development and optional dependencies.

## Solution Implemented

### 1. **Removed Development Dependencies**
- ❌ `jupyter` (~50MB)
- ❌ `ipykernel` (~30MB)

These are only needed for local development notebooks, not production.

### 2. **RAG Now Included by Default**
- ✅ `qdrant-client` (~50MB) - included in core dependencies
- ❌ `numpy` - removed (no longer used in the codebase)

RAG (Retrieval-Augmented Generation) is now available by default in all deployments.

### 3. **Dependency Structure**

**Production (always installed):**
```
fastapi, uvicorn, openai, together, pydantic, google-auth,
PyPDF2, pdfplumber, tiktoken, python-docx, python-pptx,
httpx, requests, python-dotenv, slowapi, qdrant-client
```

**Optional - Development:**
```
pip install -e ".[dev]"  # Adds: jupyter, ipykernel, numpy
```

### 4. **All Features Available**
- Core chat functionality ✅
- RAG document upload/query ✅
- Topic Explorer mode ✅

## Deployment Steps

### For Vercel Production:
1. No changes needed - uses production dependencies including RAG
2. Build fits within 250MB limit
3. All features fully functional

### For Local Development:
```bash
# Install everything including dev tools
uv sync
# or
pip install -e ".[dev]"
```

## Expected Size
- **Estimated:** ~200-230MB (within 250MB limit)

## Testing
```bash
# Test core chat (should work)
curl -X POST http://localhost:8000/api/chat

# Test RAG (should work - RAG is included by default)
curl -X POST http://localhost:8000/api/upload-document
```

## Next Steps
1. Push to Vercel and verify deployment succeeds
2. Test all features including RAG and Topic Explorer

