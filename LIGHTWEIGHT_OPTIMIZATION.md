# Lightweight RAG Optimization for Vercel Deployment

## Overview

This optimization reduces the Python dependencies from ~4GB to ~50MB to work within Vercel's free tier memory constraints while maintaining core functionality.

## Changes Made

### 1. Dependency Optimization

**Before (Heavy Dependencies):**
- `docling` + dependencies (pulls in PyTorch + CUDA libraries)
- `openai-whisper` (PyTorch)
- `numpy`, `scipy` (large scientific computing libraries)
- `yt-dlp`, `ffmpeg-python` (media processing)

**After (Lightweight Dependencies):**
- `PyPDF2` (lightweight PDF processing)
- `pdfplumber` (alternative PDF processing)
- `tiktoken` (tokenization)
- Core FastAPI and OpenAI dependencies

### 2. Files Created/Modified

#### New Files:
- `api/requirements-backup.txt` - Backup of original heavy requirements
- `api/pdf_rag_lightweight.py` - Lightweight PDF processor using PyPDF2/pdfplumber

#### Modified Files:
- `api/requirements.txt` - Updated with lightweight dependencies
- `api/app.py` - Updated imports and processor usage

### 3. Functionality Preserved

✅ **Core Features Maintained:**
- PDF upload and text extraction
- RAG queries and document search
- Chat interface and streaming
- Session management
- Rate limiting and security

📄 **PDF Processing Changes:**
- Uses PyPDF2 + pdfplumber instead of docling
- Simpler text extraction (no advanced layout analysis)
- Still supports chunking and vector search

## Trade-offs

### Removed Features:
- 🎵 Audio processing (openai-whisper)
- 📊 Advanced document layout analysis (docling)
- 🎬 Video processing (yt-dlp, ffmpeg)

### Benefits:
- ✅ Fits within Vercel free tier memory limits
- ✅ Faster build times
- ✅ Lower deployment costs
- ✅ Maintains core RAG functionality

## Testing

The changes have been tested for:
- ✅ Syntax validation
- ✅ Import compatibility
- ✅ API endpoint compatibility

## Deployment

This lightweight version should now build successfully on Vercel's free tier without OOM errors.

## Rollback Plan

If you need the full feature set for local development:
1. Use `api/requirements-backup.txt` to restore heavy dependencies
2. Switch back to `api/pdf_rag.py` for advanced PDF processing
3. Update imports in `api/app.py` accordingly

## Next Steps

1. Deploy to Vercel - should now build successfully
2. Test PDF upload and RAG functionality
3. Monitor memory usage and performance
4. Consider upgrading to Vercel Pro if you need the full feature set
