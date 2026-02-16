<p align = "center" draggable=”false” ><img src="https://github.com/AI-Maker-Space/LLM-Dev-101/assets/37101144/d1343317-fa2f-41e1-8af1-1dbb18399719" 
     width="200px"
     height="auto"/>
</p>


## <h1 align="center" id="heading"> 👋 Welcome to the AI Engineer Challenge</h1>

## 🤖 Your First Vibe Coding LLM Application

> If you are a novice, and need a bit more help to get your dev environment off the ground, check out this [Setup Guide](docs/GIT_SETUP.md). This guide will walk you through the 'git' setup you need to get started.

> For additional context on LLM development environments and API key setup, you can also check out our [Interactive Dev Environment for LLM Development](https://github.com/AI-Maker-Space/Interactive-Dev-Environment-for-AI-Engineers).

In this repository, we'll walk you through the steps to create a LLM (Large Language Model) powered application with a vibe-coded frontend!

Are you ready? Let's get started!

<details>
  <summary>🖥️ Accessing "gpt-4.1-mini" (ChatGPT) like a developer</summary>

1. Head to [this notebook](https://colab.research.google.com/drive/1sT7rzY_Lb1_wS0ELI1JJfff0NUEcSD72?usp=sharing) and follow along with the instructions!

2. Complete the notebook and try out your own system/assistant messages!

That's it! Head to the next step and start building your application!

</details>


<details>
  <summary>🏗️ Forking & Cloning This Repository</summary>

Before you begin, make sure you have:

1. 👤 A GitHub account (you'll need to replace `YOUR_GITHUB_USERNAME` with your actual username)
2. 🔧 Git installed on your local machine
3. 💻 A code editor (like Cursor, VS Code, etc.)
4. ⌨️ Terminal access (Mac/Linux) or Command Prompt/PowerShell (Windows)
5. 🔑 A GitHub Personal Access Token (for authentication)

Got everything in place? Let's move on!

1. Fork [this](https://github.com/AI-Maker-Space/The-AI-Engineer-Challenge) repo!

     ![image](https://i.imgur.com/bhjySNh.png)

1. Clone your newly created repo.

     ``` bash
     # First, navigate to where you want the project folder to be created
     cd PATH_TO_DESIRED_PARENT_DIRECTORY

     # Then clone (this will create a new folder called The-AI-Engineer-Challenge)
     git clone git@github.com:<YOUR GITHUB USERNAME>/The-AI-Engineer-Challenge.git
     ```

     > Note: This command uses SSH. If you haven't set up SSH with GitHub, the command will fail. In that case, use HTTPS by replacing `git@github.com:` with `https://github.com/` - you'll then be prompted for your GitHub username and personal access token.

2. Verify your git setup:

     ```bash
     # Check that your remote is set up correctly
     git remote -v

     # Check the status of your repository
     git status

     # See which branch you're on
     git branch
     ```

     <!-- > Need more help with git? Check out our [Detailed Git Setup Guide](docs/GIT_SETUP.md) for a comprehensive walkthrough of git configuration and best practices. -->

3. Open the freshly cloned repository inside Cursor!

     ```bash
     cd The-AI-Engineering-Challenge
     cursor .
     ```

4. Check out the existing backend code found in `/api/app.py`

</details>

<details>
  <summary>🔥Setting Up for Vibe Coding Success </summary>

While it is a bit counter-intuitive to set things up before jumping into vibe-coding - it's important to remember that there exists a gradient betweeen AI-Assisted Development and Vibe-Coding. We're only reaching *slightly* into AI-Assisted Development for this challenge, but it's worth it!

1. Check out the rules in `.cursor/rules/` and add theme-ing information like colour schemes in `frontend-rule.mdc`! You can be as expressive as you'd like in these rules!
2. We're going to index some docs to make our application more likely to succeed. To do this - we're going to start with `CTRL+SHIFT+P` (or `CMD+SHIFT+P` on Mac) and we're going to type "custom doc" into the search bar. 

     ![image](https://i.imgur.com/ILx3hZu.png)
3. We're then going to copy and paste `https://nextjs.org/docs` into the prompt.

     ![image](https://i.imgur.com/psBjpQd.png)

4. We're then going to use the default configs to add these docs to our available and indexed documents.

     ![image](https://i.imgur.com/LULLeaF.png)

5. After that - you will do the same with Vercel's documentation. After which you should see:

     ![image](https://i.imgur.com/hjyXhhC.png) 

</details>

<details>
  <summary>😎 Vibe Coding a Front End for the FastAPI Backend</summary>

🎉 **Great news!** A beautiful, modern frontend has already been created for you! 

### ✨ What's Included

- **React + TypeScript**: Modern, type-safe frontend
- **Beautiful UI**: Glassmorphism design with smooth animations
- **Real-time Streaming**: Watch AI responses appear word by word
- **Responsive Design**: Works perfectly on all devices
- **Settings Panel**: Easy API key and system message configuration
- **Docker Ready**: Fully containerized for easy deployment

### 🚀 Quick Start

#### Option 1: Docker (Recommended)
```bash
# From the project root
docker-compose up --build

# Access your app:
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

#### Option 2: Development Mode
```bash
# Backend
cd api
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Frontend (in new terminal)
cd frontend
npm install
npm run dev
```

### 🎨 Features

- **Modern Chat Interface**: Beautiful message bubbles with user/AI avatars
- **Streaming Responses**: Real-time AI responses for better UX
- **Settings Management**: Configure OpenAI API key and system messages
- **Message History**: Server-side In-memory Persistent (until inactivity expiration timeout) conversations with timestamps
- **Error Handling**: Graceful error messages and validation
- **Mobile Optimized**: Touch-friendly interface for all devices

### 🔧 Customization

Want to make it your own? The frontend is built with:
- **Vite**: Fast development and optimized builds
- **CSS**: Custom styling with glassmorphism effects
- **TypeScript**: Full type safety
- **Responsive Design**: Mobile-first approach

> 💡 **Pro Tip**: The frontend automatically proxies API calls to your FastAPI backend, so everything works seamlessly together!

</details>

<details>
  <summary>🔐 Authentication & Free Chat Turns</summary>

### 🎭 Two Ways to Chat

Your app now supports **two access modes** to make it flexible for everyone:

1. **🎁 Guest Mode** - Jump right in! No sign-up needed, just start chatting with a limited number of free turns
2. **🔑 Google Sign-In** - Sign in with your Google account for a personalized experience

### 🎟️ How Free Chat Turns Work

Everyone gets a taste of AI magic! Here's how it works:

- **Guest users** get a limited number of free chat turns per session (default: 3 turns)
- **Google users (non-whitelisted)** also get free turns with the same limits
- **Google users (whitelisted)** get unlimited access with premium models! 🌟

| User Type | Free Turns | Model Access | API Key Used |
|-----------|------------|--------------|--------------|
| 🎭 Guest | Limited (default: 3) | Free tier model only | Server-side (Together.ai) |
| 🔑 Google (non-whitelisted) | Limited (default: 3) | Free tier model only | Server-side (Together.ai) |
| ⭐ Google (whitelisted) | Unlimited | All models | Server-side (OpenAI/Together.ai) |

> 💡 **Pro Tip**: Free turns reset when your session expires (default: 60 minutes of inactivity)

### 🔧 Setting Up Google OAuth (Optional)

Want to enable Google Sign-In? Here's how to get your Client ID:

1. **Head to Google Cloud Console** 🌐
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** → **Credentials**

2. **Create OAuth 2.0 Client ID** 🔑
   - Click **Create Credentials** → **OAuth 2.0 Client ID**
   - Choose **Web application** as the application type
   - Give it a friendly name (e.g., "AI Chat App")

3. **Configure Authorized Origins** 🌍
   - Add `http://localhost:3000` for local development
   - Add your production domain when deploying (e.g., `https://your-app.vercel.app`)

4. **Copy Your Client ID** 📋
   - Copy the generated Client ID
   - Set it as `GOOGLE_CLIENT_ID` in your `.env` file

> 🎨 **Note**: If you don't set `GOOGLE_CLIENT_ID`, the Google Sign-In button will be hidden and only Guest mode will be available!

### ⚙️ Environment Variables

The backend supports comprehensive configuration via environment variables. Here's the complete list:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID for authentication | — | No (if absent, Google Sign-In is hidden) |
| `WHITELISTED_EMAILS` | Comma-separated list of emails with unlimited access | — | No |
| `OPENAI_API_KEY` | Server-side OpenAI API key for whitelisted users | — | No |
| `TOGETHER_API_KEY` | Server-side Together.ai API key for free turns | — | Yes (for free turns feature) |
| `FREE_PROVIDER` | Provider to use for free chat turns | `together` | No |
| `FREE_MODEL` | Model to use for free chat turns | `deepseek-ai/DeepSeek-V3.1` | No |
| `MAX_FREE_TURNS` | Maximum free chat turns per session | `3` | No |
| `MAX_FREE_MESSAGE_TOKENS` | Maximum input tokens during free turns | `500` | No |
| `SESSION_TIMEOUT_MINUTES` | How long before inactive sessions are cleaned up (minutes) | `60` | No |
| `CLEANUP_INTERVAL_SECONDS` | How often the cleanup scheduler runs (seconds) | `60` | No |

### 📝 Example `.env` File

Copy `.env.example` to `.env` and customize as needed:

```bash
cp .env.example .env
```

Here's a sample configuration:

```env
# Google OAuth (optional - if not set, only Guest mode is available)
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com

# Whitelisted emails for unlimited access (optional)
WHITELISTED_EMAILS=admin@example.com,vip@example.com

# API Keys
OPENAI_API_KEY=sk-your-openai-key-here
TOGETHER_API_KEY=your-together-api-key-here

# Free Tier Configuration
FREE_PROVIDER=together
FREE_MODEL=deepseek-ai/DeepSeek-V3.1
MAX_FREE_TURNS=3
MAX_FREE_MESSAGE_TOKENS=500

# Session Management
SESSION_TIMEOUT_MINUTES=60
CLEANUP_INTERVAL_SECONDS=60
```

> 🔒 **Security Note**: Never commit your `.env` file to version control! It's already in `.gitignore` to keep your secrets safe.

</details>

<details>
  <summary>🚀 Deploying Your First LLM-powered Application with Vercel</summary>

1. Ensure you have signed into [Vercel](https://vercel.com/) with your GitHub account.

2. Ensure you have `npm` (this may have been installed in the previous vibe-coding step!) - if you need help with that, ask Cursor!

3. Run the command:

     ```bash
     npm install -g vercel
     ```

4. Run the command:

     ```bash
     vercel
     ```

5. Follow the in-terminal instructions. (Below is an example of what you will see!)

     ![image](https://i.imgur.com/D1iKGCq.png)

6. Once the build is completed - head to the provided link and try out your app!

> NOTE: Remember, if you run into any errors - ask Cursor to help you fix them!

</details>

### Vercel Link to Share

You'll want to make sure you share you *domains* hyperlink to ensure people can access your app!

![image](https://i.imgur.com/mpXIgIz.png)

> NOTE: Test this is the public link by trying to open your newly deployed site in an Incognito browser tab!

### 🎉 Congratulations! 

You just deployed your first LLM-powered application! 🚀🚀🚀 Get on linkedin and post your results and experience! Make sure to tag us at @AIMakerspace!

Here's a template to get your post started!

```
🚀🎉 Exciting News! 🎉🚀

🏗️ Today, I'm thrilled to announce that I've successfully built and shipped my first-ever LLM using the powerful combination of , and the OpenAI API! 🖥️

Check it out 👇
[LINK TO APP]

A big shoutout to the @AI Makerspace for all making this possible. Couldn't have done it without the incredible community there. 🤗🙏

Looking forward to building with the community! 🙌✨ Here's to many more creations ahead! 🥂🎉

Who else is diving into the world of AI? Let's connect! 🌐💡

#FirstLLMApp 
```
