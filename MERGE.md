# 🗄️ Merge Instructions: Upstash Redis Persistence

## What this branch does
Adds Upstash Redis conversation persistence for Google-authenticated users. Chat history now survives across logout/login cycles and server restarts.

## Prerequisites
Before deploying, set up Upstash Redis:
1. Create a free database at https://console.upstash.com/
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars in your Vercel project settings (or `.env` for local dev)

## Option A: GitHub PR (Web UI)
1. Go to your repo on GitHub
2. Click **"Compare & pull request"** for `feature/upstash-redis-persistence`
3. Set base branch to `main`
4. Review the changes, then **"Create pull request"**
5. After review, click **"Merge pull request"**

## Option B: GitHub CLI
```bash
# Push the branch
git push origin feature/upstash-redis-persistence

# Create a PR
gh pr create --base main --head feature/upstash-redis-persistence \
  --title "feat: Add Upstash Redis conversation persistence" \
  --body "Adds lightweight conversation persistence for Google-authenticated users using Upstash Redis."

# After review, merge
gh pr merge --squash
```

---

# 🚀 Merge Instructions: Google OAuth Authentication Feature

Hey there! 👋 Ready to bring Google OAuth authentication to the main branch? This guide will walk you through merging PR #13 like a pro.

## 🎯 What You're Merging

This PR adds optional Google OAuth authentication with:
- 🔐 Google Sign-In (optional, configurable)
- 🎟️ Free chat turns for guests and non-whitelisted users
- ✅ Email whitelisting for unlimited access
- 🔒 Secure API key handling (no localStorage, no query params)

**PR Link**: https://github.com/rafaeltuelho/The-AI-Engineer-Challenge/pull/13

---

## ✅ Pre-Merge Checklist

Before you merge, make sure you've got these environment variables ready:

### Required for Free Tier
```bash
TOGETHER_API_KEY=your_together_api_key_here
```

### Optional (but recommended for Google OAuth)
```bash
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
WHITELISTED_EMAILS=admin@example.com,vip@example.com
```

### Optional Customization
```bash
FREE_PROVIDER=together                    # Default: together
FREE_MODEL=deepseek-ai/DeepSeek-V3.1     # Default: deepseek-ai/DeepSeek-V3.1
MAX_FREE_TURNS=3                          # Default: 3
MAX_FREE_MESSAGE_TOKENS=500               # Default: 500
```

> **Note**: If you don't set `GOOGLE_CLIENT_ID`, the Google Sign-In button won't appear, and users will only see "Continue as Guest".

### Testing Steps (Recommended)
1. **Test Guest Flow**: Start the app without `GOOGLE_CLIENT_ID` and verify guest sessions work
2. **Test Google OAuth**: Add `GOOGLE_CLIENT_ID` and test Google Sign-In
3. **Test Whitelisting**: Add your email to `WHITELISTED_EMAILS` and verify unlimited access
4. **Test Free Turns**: As a guest, verify you get exactly `MAX_FREE_TURNS` free messages
5. **Test API Key Fallback**: Exhaust free turns and verify the API key prompt appears

---

## 🌐 Route 1: GitHub Web UI (The Clicky Way)

Perfect for visual folks who like buttons! 🖱️

1. **Navigate to the PR**
   Go to: https://github.com/rafaeltuelho/The-AI-Engineer-Challenge/pull/13

2. **Review the Changes**
   - Click the "Files changed" tab
   - Review the 18 changed files (+1629 additions, -208 deletions)
   - Check out the new auth components, backend endpoints, and security improvements

3. **Run CI Checks** (if configured)
   - Wait for any automated tests to pass ✅
   - If tests fail, address issues before merging

4. **Merge the PR**
   - Scroll to the bottom of the PR page
   - Click the big green **"Merge pull request"** button
   - Choose your merge strategy:
     - **Create a merge commit** (recommended) — Preserves full history
     - **Squash and merge** — Combines all 6 commits into one
     - **Rebase and merge** — Replays commits on top of main
   - Click **"Confirm merge"**

5. **Delete the Branch** (optional but tidy)
   - After merging, GitHub will offer to delete `add-google-oauth-authentication`
   - Click **"Delete branch"** to keep your repo clean

6. **Pull the Latest Main**
   ```bash
   git checkout main
   git pull origin main
   ```

---

## 💻 Route 2: GitHub CLI (The Terminal Ninja Way)

For those who live in the terminal! ⌨️

### Prerequisites
Make sure you have the GitHub CLI installed:
```bash
# Check if gh is installed
gh --version

# If not, install it:
# macOS
brew install gh

# Linux
sudo apt install gh  # Debian/Ubuntu
sudo dnf install gh  # Fedora

# Windows
winget install GitHub.cli
```

### Authenticate (if you haven't already)
```bash
gh auth login
```

### Merge the PR

#### Option A: Auto-Merge (Quick & Easy)
```bash
# Merge PR #13 with a merge commit
gh pr merge 13 --merge --delete-branch

# Or squash all commits into one
gh pr merge 13 --squash --delete-branch

# Or rebase onto main
gh pr merge 13 --rebase --delete-branch
```

#### Option B: Review First, Then Merge
```bash
# View PR details
gh pr view 13

# Check out the PR locally to test
gh pr checkout 13

# Run tests, verify functionality
npm run dev  # or whatever your test command is

# If everything looks good, merge it
gh pr merge 13 --merge --delete-branch
```

### Pull the Latest Main
```bash
git checkout main
git pull origin main
```

---

## 🧹 Post-Merge Cleanup

### Local Branch Cleanup
If you checked out the feature branch locally, clean it up:

```bash
# Delete local branch
git branch -d add-google-oauth-authentication

# If it complains, force delete
git branch -D add-google-oauth-authentication

# Prune remote-tracking branches
git fetch --prune
```

### Verify Deployment
After merging, verify the feature works in your deployment environment:

1. **Set environment variables** in your hosting platform (Vercel, Heroku, etc.)
2. **Redeploy** if necessary
3. **Test the auth flow** in production:
   - Guest sign-in
   - Google OAuth (if enabled)
   - Free turns mechanism
   - API key fallback

---

## 🎉 You're Done!

Congrats! You've successfully merged the Google OAuth authentication feature. Your app now has:
- ✅ Optional Google Sign-In
- ✅ Free chat turns for guests
- ✅ Email whitelisting
- ✅ Secure API key handling

### Need Help?
- **PR Issues**: Comment on PR #13
- **Merge Conflicts**: Reach out to the PR author
- **Environment Setup**: Check the PR description for detailed env var docs

---

**Happy Merging! 🚀**

