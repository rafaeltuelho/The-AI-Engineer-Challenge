# PDF Upload and RAG Functionality - Merge Instructions

This document provides instructions for merging the PDF upload and RAG functionality feature branch back to the main branch.

## Feature Overview

This feature adds comprehensive PDF upload and Retrieval-Augmented Generation (RAG) capabilities to the application:

- **PDF Upload**: Users can upload PDF documents through a drag-and-drop interface
- **PDF Processing**: Documents are processed using the docling library with HybridChunker and OpenAITokenizer
- **RAG System**: Built using the aimakerspace library for vector database and retrieval
- **Document Chat**: Users can ask questions about uploaded documents with context-aware responses

## Changes Made

### Backend Changes

1. **New Dependencies** (`api/requirements.txt`):
   - Added `docling==2.52.0` for PDF processing
   - Added `numpy>=1.24.0` and `scipy>=1.10.0` for vector operations

2. **New Files**:
   - `api/pdf_rag.py`: Core PDF processing and RAG functionality
   - `aimakerspace/`: Local aimakerspace library implementation

3. **Updated Files**:
   - `api/app.py`: Added PDF upload and RAG query endpoints
   - Added new data models for PDF upload and RAG responses

### Frontend Changes

1. **New Components**:
   - `frontend/src/components/PDFUpload.tsx`: PDF upload interface
   - `frontend/src/components/PDFUpload.css`: Styling for PDF upload
   - `frontend/src/components/RAGQuery.tsx`: RAG query interface
   - `frontend/src/components/RAGQuery.css`: Styling for RAG query

2. **Updated Components**:
   - `frontend/src/components/ChatInterface.tsx`: Integrated PDF upload and RAG functionality
   - `frontend/src/components/ChatInterface.css`: Added styling for new features

## Merge Instructions

### Option 1: GitHub Pull Request (Recommended)

1. **Push the feature branch**:
   ```bash
   git push origin feature/pdf-upload-rag
   ```

2. **Create a Pull Request**:
   - Go to the GitHub repository
   - Click "Compare & pull request" for the `feature/pdf-upload-rag` branch
   - Add a descriptive title: "Add PDF Upload and RAG Functionality"
   - Add description:
     ```
     This PR adds comprehensive PDF upload and RAG capabilities:
     
     - PDF upload with drag-and-drop interface
     - Document processing using docling library
     - RAG system using aimakerspace library
     - Context-aware document chat functionality
     
     Features:
     - Upload PDF documents (max 10MB)
     - Automatic document chunking and indexing
     - Vector-based similarity search
     - LLM responses based only on document context
     ```

3. **Review and Merge**:
   - Review the changes
   - Run tests if available
   - Merge the pull request

### Option 2: GitHub CLI

1. **Push the feature branch**:
   ```bash
   git push origin feature/pdf-upload-rag
   ```

2. **Create and merge PR using GitHub CLI**:
   ```bash
   # Create pull request
   gh pr create --title "Add PDF Upload and RAG Functionality" \
     --body "This PR adds comprehensive PDF upload and RAG capabilities with document processing, vector indexing, and context-aware chat functionality." \
     --base main --head feature/pdf-upload-rag
   
   # Merge the pull request
   gh pr merge --merge --delete-branch
   ```

3. **Switch back to main and pull changes**:
   ```bash
   git checkout main
   git pull origin main
   ```

### Option 3: Direct Git Merge

1. **Switch to main branch**:
   ```bash
   git checkout main
   ```

2. **Merge the feature branch**:
   ```bash
   git merge feature/pdf-upload-rag
   ```

3. **Push to main**:
   ```bash
   git push origin main
   ```

4. **Delete the feature branch**:
   ```bash
   git branch -d feature/pdf-upload-rag
   git push origin --delete feature/pdf-upload-rag
   ```

## Post-Merge Setup

After merging, ensure the following:

1. **Install Dependencies**:
   ```bash
   cd api
   pip install -r requirements.txt
   ```

2. **Test the Application**:
   - Start the backend: `cd api && python app.py`
   - Start the frontend: `cd frontend && npm run dev`
   - Test PDF upload functionality
   - Test RAG query functionality

3. **Environment Variables**:
   - Ensure `OPENAI_API_KEY` is set for the RAG functionality
   - The application will use the API key provided by users in the frontend

## API Endpoints Added

- `POST /api/upload-pdf`: Upload and process PDF documents
- `POST /api/rag-query`: Query documents using RAG
- `GET /api/documents`: Get information about uploaded documents

## Frontend Features Added

- PDF upload with drag-and-drop interface
- Document management and display
- RAG query interface
- Integration with existing chat functionality

## Security Considerations

- File size limits (10MB max)
- File type validation (PDF only)
- Session-based document storage
- API key validation and hashing
- Rate limiting on all endpoints

## Performance Considerations

- Document chunking for efficient retrieval
- Vector database for fast similarity search
- Session-based storage with automatic cleanup
- Streaming responses for better UX

## Testing Recommendations

1. Test PDF upload with various document types
2. Test RAG queries with different question types
3. Test error handling for invalid files
4. Test session management and cleanup
5. Test rate limiting functionality

## Rollback Instructions

If issues arise after merging:

1. **Revert the merge**:
   ```bash
   git revert -m 1 <merge-commit-hash>
   ```

2. **Or reset to previous commit**:
   ```bash
   git reset --hard HEAD~1
   git push --force-with-lease origin main
   ```

## Support

For any issues with the PDF upload and RAG functionality:

1. Check the browser console for frontend errors
2. Check the backend logs for processing errors
3. Verify all dependencies are installed correctly
4. Ensure OpenAI API key is valid and has sufficient credits

The implementation follows best practices for security, performance, and user experience while providing a robust PDF upload and RAG system.
