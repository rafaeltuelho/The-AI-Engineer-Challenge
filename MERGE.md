# Merge Instructions: Chat UI Refinements

This branch adds two focused chat UI improvements:

- Conversation history delete now requires an inline confirmation step.
- The message composer behaves more like ChatGPT: it keeps a comfortable one-row minimum, expands smoothly for multiline text, and scrolls internally after reaching its max height.

Branch: `codex/follow-up-work`

## Pre-Merge Checklist

From the repository root:

```bash
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
   fix: refine chat history delete and composer input
   ```

5. Suggested PR body:

   ```text
   ## Summary
   - Add inline confirmation before deleting conversations from history
   - Improve composer textarea auto-resize behavior for multiline input
   - Add focused tests for delete confirmation and input expansion

   ## Verification
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
  --title "fix: refine chat history delete and composer input" \
  --body "## Summary
- Add inline confirmation before deleting conversations from history
- Improve composer textarea auto-resize behavior for multiline input
- Add focused tests for delete confirmation and input expansion

## Verification
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
