# Merge Instructions

This branch fixes the mobile session history drawer so conversation rows render as stable, readable list items without horizontal overflow.

## GitHub PR Route

1. Push the branch:
   ```bash
   git push origin codex/fix-session-history-ui
   ```
2. Open GitHub and create a pull request from `codex/fix-session-history-ui` into `main`.
3. Confirm CI passes and review the mobile history drawer screenshots or local test notes.
4. Merge the PR using the repository's preferred merge strategy.

## GitHub CLI Route

1. Push the branch:
   ```bash
   git push origin codex/fix-session-history-ui
   ```
2. Create the PR:
   ```bash
   gh pr create --base main --head codex/fix-session-history-ui --title "Fix mobile session history UI" --body "Fixes the mobile session history drawer layout, prevents horizontal overflow, and stabilizes conversation row rendering."
   ```
3. Watch checks:
   ```bash
   gh pr checks --watch
   ```
4. Merge after review:
   ```bash
   gh pr merge --squash --delete-branch
   ```
