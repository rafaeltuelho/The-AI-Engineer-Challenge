# Personal ChatGPT Clone

This is my personal ChatGPT-clone where I play, learn, and experiment with OpenAI and other LLM providers. It is also a practical little home base for self-learning and for serving my family with a ChatGPT-like experience I can shape myself.

The project started from [AI-Maker-Space/The-AI-Engineer-Challenge](https://github.com/AI-Maker-Space/The-AI-Engineer-Challenge). It has since grown into my own maintained sandbox, with its own features, experiments, authentication flow, persistence choices, and frontend personality.

## What It Does

- Provides a ChatGPT-style web UI for chatting with LLMs.
- Supports OpenAI and Together.ai provider flows.
- Streams assistant responses into the chat interface.
- Keeps session-scoped conversation history.
- Supports Google sign-in and guest sessions.
- Allows whitelisted users to use server-side API keys.
- Gives non-whitelisted users a configurable free-turn path.
- Supports image attachments for OpenAI chat.
- Supports document upload, Doc Q&A, and Topic Explorer style learning flows.
- Includes text-to-speech and audio transcription endpoints.
- Includes personalization settings for user preferences and response style.
- Runs locally with a FastAPI backend and a Vite/React frontend.

## Project Shape

```text
.
├── api/                 # FastAPI backend, auth, chat, RAG, TTS, persistence hooks
├── frontend/            # React + TypeScript + Vite chat UI
├── aimakerspace/        # Lightweight helper modules used by the backend
├── docs/                # Supporting project notes
├── docker-compose.yml   # Containerized local run option
├── package.json         # Root dev orchestration scripts
├── pyproject.toml       # Python project/dependency metadata
└── vercel.json          # Vercel deployment config
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, CSS modules-by-convention, Lucide icons, React Markdown, KaTeX.
- **Backend:** FastAPI, Uvicorn, OpenAI SDK, Together.ai-compatible provider path, Google OAuth validation.
- **Testing:** Vitest, React Testing Library, jsdom.
- **Local orchestration:** root `npm run dev` starts both backend and frontend.
- **Python tooling:** `uv` is used by the dev script for backend execution.

## Local Setup

Before starting the app, you need an environment file into the repo root:

```bash
cp .env.example .env
```

The `.env` file is intentionally ignored by Git. Keep API keys, OAuth client IDs, and provider credentials there, not in source control.

Install dependencies:

```bash
npm install
cd frontend
npm install
cd ..
```

Start the full local dev stack:

```bash
npm run dev
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- FastAPI docs: `http://localhost:8000/docs`

## Environment Variables

Common backend configuration:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in when present. |
| `WHITELISTED_EMAILS` | Comma-separated emails with unlimited/server-key access. |
| `OPENAI_API_KEY` | Server-side OpenAI key for whitelisted users and backend features. |
| `TOGETHER_API_KEY` | Server-side Together.ai key for free-tier/provider experiments. |
| `FREE_PROVIDER` | Provider used for free-turn users. Defaults to `together`. |
| `FREE_MODEL` | Model used for free-turn users. |
| `MAX_FREE_TURNS` | Number of free turns for non-whitelisted sessions. |
| `MAX_FREE_MESSAGE_TOKENS` | Token cap for free-tier messages. |
| `MAX_IMAGE_SIZE_MB` | Image upload size limit for chat attachments. |

The app may also use persistence-related variables depending on the current backend configuration. Check [api/persistence.py](api/persistence.py) before deploying anything serious.

## Useful Commands

Run the whole app in development:

```bash
npm run dev
```

Build the frontend:

```bash
cd frontend
npm run build
```

Run frontend tests:

```bash
cd frontend
npm test
```

Run the backend directly:

```bash
uv run uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

Run with Docker Compose:

```bash
docker-compose up --build
```

## Main App Flows

### Authentication

The app supports guest sessions and Google sign-in. Google sign-in appears when `GOOGLE_CLIENT_ID` is configured. Whitelisted emails can use server-side provider keys without entering their own key in the UI.

### Chat

The main chat UI supports streamed responses, model/provider selection, session history, markdown rendering, math formatting, suggested follow-up questions, and mobile-friendly navigation.

### Study & Learn

Study & Learn is the default learning-oriented mode. It guides the assistant toward short, engaging explanations and progressively richer follow-up learning.

### Documents

Doc Q&A and Topic Explorer support document-centered learning. Upload a document, ask questions, and let the backend build context for the response path.

### Media

OpenAI chat can accept image attachments in regular chat mode. The backend also exposes text-to-speech and transcription endpoints for voice experiments.

### Personalization

Settings include non-sensitive personalization fields such as nickname, occupation, response style, and custom instructions. These are meant to shape assistant responses without storing secrets.

## Deployment Notes

The frontend is intended to be Vercel-friendly, and the backend has Vercel configuration in place. Before deploying:

- Verify environment variables in the deployment platform.
- Confirm API keys are server-side only.
- Confirm Google OAuth allowed origins include the deployed URL.
- Check provider/model availability, especially for Together.ai models.
- Review persistence behavior for sessions, conversations, and personalization.

## Security Notes

- Never commit `.env` or plaintext API keys.
- Do not pass API keys in query strings.
- Keep user-provided API keys in headers or secure server-side session handling.
- Treat Google session data and conversation history as private.
- Review CORS and rate-limiting settings before exposing the backend publicly.

## Why This Exists

This repo is my learning garage: part product, part lab bench, part family utility. It lets me try provider APIs, UX ideas, model behavior, document workflows, auth flows, and deployment patterns in one place without pretending every experiment has to be polished forever.

That is the fun of it: small enough to change quickly, real enough to matter.
