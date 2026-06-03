# Merge Instructions: Personalization Settings

This branch adds ChatGPT-style personalization settings and fixes OpenAI Responses API message handling so system/developer instructions are no longer flattened into plain text.

## What Is Included

- Backend `GET`, `PUT`, and `DELETE` endpoints for `/api/personalization`
- Redis persistence for Google-authenticated users using hashed email-derived keys
- Session-scoped personalization for guest and API-key users
- Server-side prompt composition that treats personalization as untrusted preference context
- Regular chat and RAG/topic-explorer personalization support
- Responses API request formatting that sends system/developer content through `instructions` and conversation turns through structured `input`
- Settings modal UI for nickname, occupation, about-you context, response style, and custom preferences

Branch: `codex/personalization-settings`

## Pre-Merge Checklist

Run the verification commands from the repository root:

```bash
uv run --extra dev pytest api/tests/test_app.py -q
cd frontend
npm test -- --run src/components/SettingsModal.test.tsx
npm run build
```

For local manual testing, copy the environment file before starting services:

```bash
cp ~/tmp/tuelhosai.env .env
npm run dev
```

Do not commit `.env`.

## GitHub PR Route

1. Push the branch:

   ```bash
   git push origin codex/personalization-settings
   ```

2. Open the repository on GitHub.
3. Create a pull request from `codex/personalization-settings` into `main`.
4. Use a title like:

   ```text
   feat: add personalization settings
   ```

5. In the PR description, mention:

   ```text
   Adds persisted personalization settings, server-side prompt composition, Settings UI controls, and structured Responses API input handling.
   ```

6. Wait for CI, review the changed files, and merge using the team-preferred strategy.

## GitHub CLI Route

From the repository root:

```bash
git push origin codex/personalization-settings

gh pr create \
  --base main \
  --head codex/personalization-settings \
  --title "feat: add personalization settings" \
  --body "Adds persisted personalization settings, server-side prompt composition, Settings UI controls, and structured Responses API input handling."

gh pr view --web
```

After review and passing checks:

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull origin main
```

## Post-Merge Smoke Test

1. Sign in or create a guest session.
2. Open Settings.
3. Fill in Personalization fields and save.
4. Send a regular chat message and confirm the answer reflects the saved preferences.
5. Upload/query a document and confirm RAG mode still responds normally.
6. Confirm API keys are still only entered through the password-style API key field.
