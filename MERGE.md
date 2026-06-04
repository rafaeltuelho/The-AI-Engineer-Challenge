# Merge Instructions: Chat UX and Responsiveness Refinements

This branch adds focused chat UX and responsiveness improvements:

- Conversation history delete now requires an inline confirmation step.
- The message composer behaves more like ChatGPT: it keeps a comfortable one-row minimum, expands smoothly for multiline text, and scrolls internally after reaching its max height.
- Document modes are explicit: regular Chat can attach document context, while Doc Q&A/Topic Explorer own the document summary and RAG-style behavior.
- Regular chat no longer enables Web Search by default, avoiding hidden tool orchestration latency. Users can still opt into Web Search from the composer menu or chip.

Branch: `codex/follow-up-work`

## Pre-Merge Checklist

From the repository root:

```bash
uv run pytest -q api/tests/test_app.py
cd frontend
npm test -- --run src/components/ChatInterface.imageAttachment.test.tsx
npm run build
```

For local manual testing:

```bash
cp ~/tmp/tuelhosai.env .env
npm run dev
```

Do not commit `.env`.

## GitHub PR Route

1. Push this branch:

   ```bash
   git push origin codex/follow-up-work
   ```

2. Open the repo on GitHub.
3. Create a PR from `codex/follow-up-work` into `main`.
4. Suggested title:

   ```text
   fix: refine chat UX and responsiveness
   ```

5. Suggested PR body:

   ```text
   ## Summary
   - Add inline confirmation before deleting conversations from history
   - Improve composer textarea auto-resize behavior for multiline input
   - Add explicit Doc Q&A document mode behavior and summary handling
   - Make Web Search opt-in so regular chat avoids hidden tool latency

   ## Verification
   - uv run pytest -q api/tests/test_app.py
   - npm test -- --run src/components/ChatInterface.imageAttachment.test.tsx
   - npm run build
   ```

6. Review the UI manually on desktop and mobile widths before merging.

## GitHub CLI Route

```bash
git push origin codex/follow-up-work

gh pr create \
  --base main \
  --head codex/follow-up-work \
  --title "fix: refine chat UX and responsiveness" \
  --body "## Summary
- Add inline confirmation before deleting conversations from history
- Improve composer textarea auto-resize behavior for multiline input
- Add explicit Doc Q&A document mode behavior and summary handling
- Make Web Search opt-in so regular chat avoids hidden tool latency

## Verification
- uv run pytest -q api/tests/test_app.py
- npm test -- --run src/components/ChatInterface.imageAttachment.test.tsx
- npm run build"
```

After review:

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull origin main
```

## Manual Smoke Test

1. Open `http://localhost:3000/`.
2. Hover a conversation in the left history panel and click the delete icon.
3. Confirm that `Delete` and `Cancel` appear inline.
4. Click `Cancel` and confirm the conversation remains.
5. Repeat and click `Delete`; confirm the conversation is removed.
6. Type several lines into the message composer and confirm it expands smoothly.
7. Keep typing past the max height and confirm the input scrolls internally without shifting the whole layout awkwardly.
8. Start a fresh regular chat and confirm the `Web Search` chip is not active by default.
9. Enable `Web Search` from the composer menu and confirm the chip appears and the next chat request can use search.
10. Start a fresh Doc Q&A session, upload a document, and confirm the summary replaces the empty welcome panel.
