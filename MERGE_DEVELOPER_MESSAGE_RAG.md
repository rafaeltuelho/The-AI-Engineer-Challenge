# Merge Instructions: Developer Message RAG Integration

## Overview
This feature branch adds support for custom developer messages in RAG queries, allowing the UI to customize the system message used by the AI when processing document-based queries.

## Changes Made

### Backend Changes (`api/`)
1. **Modified `RAGQueryRequest` model** (`app.py`):
   - Added `developer_message` field with validation
   - Added field validator for developer message content (max 5,000 characters)

2. **Updated RAG query endpoint** (`app.py`):
   - Modified `/api/rag-query` to accept `developer_message` parameter
   - Updated conversation initialization to use the provided developer message
   - Pass `developer_message` to `rag_system.query()` as `system_message` parameter

3. **Enhanced RAG system** (`rag_lightweight.py`):
   - Updated `query()` method to accept optional `system_message` parameter
   - Modified logic to use custom system message when provided, falling back to defaults
   - Updated method documentation

### Frontend Changes (`frontend/`)
1. **Updated ChatInterface component** (`ChatInterface.tsx`):
   - Added `getDefaultDeveloperMessage()` function with mode-specific defaults
   - Modified RAG query requests to include `developer_message` parameter
   - Updated chat mode switching to automatically set appropriate default messages
   - Enhanced PDF upload handler to set RAG mode default message

### Default Developer Messages by Mode
- **Chat mode**: `"You are a helpful AI assistant."`
- **RAG mode**: `"You are a helpful assistant that answers questions based on provided context. If the context doesn't contain enough information to answer the question, please say so."`
- **Topic Explorer mode**: `""` (empty string)

## Testing
- All changes maintain backward compatibility
- RAG queries now use custom system messages from the UI
- Chat mode switching automatically updates developer messages
- Document uploads properly switch to RAG mode with appropriate defaults

## Merge Instructions

### Option 1: GitHub Pull Request (Recommended)
1. Push the feature branch to GitHub:
   ```bash
   git push origin feature/developer-message-rag-integration
   ```

2. Create a Pull Request on GitHub:
   - Base branch: `main` (or your default branch)
   - Head branch: `feature/developer-message-rag-integration`
   - Title: "feat: integrate developer_message parameter in RAG queries"
   - Description: Use the commit message details above

3. Review and merge the Pull Request through GitHub UI

### Option 2: GitHub CLI
1. Push the feature branch:
   ```bash
   git push origin feature/developer-message-rag-integration
   ```

2. Create and merge PR using GitHub CLI:
   ```bash
   gh pr create --title "feat: integrate developer_message parameter in RAG queries" --body "Adds support for custom developer messages in RAG queries with mode-specific defaults"
   gh pr merge --merge
   ```

3. Clean up the feature branch:
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/developer-message-rag-integration
   git push origin --delete feature/developer-message-rag-integration
   ```

## Post-Merge Verification
After merging, verify that:
1. RAG queries accept and use custom developer messages
2. Chat mode switching updates developer messages appropriately
3. Document uploads work correctly with RAG mode
4. All existing functionality remains intact
5. API validation works for developer message length limits

## Files Modified
- `api/app.py` - RAG endpoint and request model updates
- `api/rag_lightweight.py` - RAG system query method enhancement
- `frontend/src/components/ChatInterface.tsx` - UI integration and default messages

## Breaking Changes
None - all changes are backward compatible.
