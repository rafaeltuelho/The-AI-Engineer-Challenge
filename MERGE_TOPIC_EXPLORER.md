# Merge Instructions: Topic Explorer RAG Mode

## Overview
This feature adds a new "Topic Explorer" RAG mode to the existing application, providing structured educational responses for middle school students. The mode offers three-part responses: Explanation, Real-Life Example, and Practice Activity.

## Changes Made

### Frontend Changes
- **ChatInterface.tsx**: 
  - Replaced `isRagMode` boolean with `chatMode` state supporting three modes: 'regular', 'rag', 'topic-explorer'
  - Added three clickable mode badges: AI Chat, RAG, and Topic Explorer
  - Updated mode indicator to show all three options with proper styling
  - Added BookOpen icon for Topic Explorer mode

- **ChatInterface.css**:
  - Replaced single mode indicator with flexible mode badges layout
  - Added styling for active/inactive badge states
  - Added topic-explorer-mode styling for conversation history (purple theme)

### Backend Changes
- **app.py**:
  - Added `mode` parameter to `RAGQueryRequest` model
  - Updated RAG query endpoint to pass mode parameter to RAG system
  - Updated conversation storage to handle topic-explorer mode

- **rag_lightweight.py**:
  - Modified `query()` and `query_documents()` methods to accept mode parameter
  - Implemented Topic Explorer prompt template with structured 3-part response format
  - Added conditional prompt generation based on mode (rag vs topic-explorer)

## How to Merge

### Option 1: GitHub Pull Request (Recommended)
1. Push the current branch to GitHub:
   ```bash
   git push origin feature/multi-document-support
   ```

2. Create a Pull Request on GitHub:
   - Go to the repository on GitHub
   - Click "Compare & pull request" 
   - Title: "Add Topic Explorer RAG Mode with Structured Educational Responses"
   - Description: Use the commit message content above
   - Request review from team members
   - Merge after approval

### Option 2: GitHub CLI
```bash
# Push the branch
git push origin feature/multi-document-support

# Create and merge PR using GitHub CLI
gh pr create --title "Add Topic Explorer RAG Mode with Structured Educational Responses" \
  --body "This PR adds a new Topic Explorer RAG mode that provides structured educational responses for middle school students.

## Features Added:
- Three mode badges: AI Chat, RAG, and Topic Explorer
- Structured 3-part responses: Explanation, Real-Life Example, Practice Activity
- Student-friendly educational prompts
- Visual mode indicators and conversation history styling

## Testing:
- Frontend: Mode badges work correctly, styling applied
- Backend: Topic Explorer mode generates structured responses
- Integration: End-to-end functionality verified"
  --base main --head feature/multi-document-support

# Review and merge
gh pr merge --merge --delete-branch
```

## Testing the Feature

### Manual Testing Steps:
1. **Start the application**:
   ```bash
   npm run dev  # Frontend
   cd api && python -m uvicorn app:app --reload --port 8000  # Backend
   ```

2. **Test Mode Switching**:
   - Open the chat interface
   - Verify three mode badges are visible: AI Chat, RAG, Topic Explorer
   - Click each badge to switch modes
   - Verify active state styling

3. **Test Topic Explorer Mode**:
   - Upload a PDF document (e.g., science textbook)
   - Select "Topic Explorer" mode
   - Ask a question like "What is photosynthesis?"
   - Verify response has 3 sections: Explanation, Real-Life Example, Practice Activity

4. **Test Backward Compatibility**:
   - Verify existing RAG mode still works
   - Verify regular chat mode still works
   - Check conversation history shows correct mode indicators

### API Testing:
```bash
# Test Topic Explorer mode
curl -X POST "http://localhost:8000/api/rag-query" \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: test-session" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "question": "What is photosynthesis?", 
    "mode": "topic-explorer", 
    "k": 3
  }'
```

## Rollback Plan
If issues arise, rollback by:
1. Revert the commit: `git revert HEAD`
2. Or reset to previous commit: `git reset --hard HEAD~1`

## Dependencies
No new dependencies added. Uses existing:
- React (frontend)
- FastAPI (backend)
- OpenAI API
- Existing RAG system

## Documentation Updates
- Update README.md to mention Topic Explorer mode
- Add screenshots of the three mode badges
- Document the structured response format

## Post-Merge Tasks
1. Update documentation
2. Add unit tests for Topic Explorer mode
3. Consider adding more educational prompt templates
4. Monitor user feedback for improvements
