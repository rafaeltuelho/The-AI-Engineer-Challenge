# 🤖 AI Chat Frontend

A modern, responsive web frontend for the AI Chat API built with React, TypeScript, and Vite. This beautiful chat interface integrates seamlessly with your FastAPI backend to provide an amazing user experience for AI-powered conversations.

## ✨ Features

- **Modern UI/UX**: Beautiful glassmorphism design with smooth animations
- **🔐 Google OAuth Authentication**: Optional Google Sign-In for personalized experience
- **🎁 Free Chat Turns**: Guests and non-whitelisted users get limited free turns
- **👤 Entry Screen**: Choose between Guest mode or Google Sign-In
- **🔒 Auth-Aware UI**: Free turns badge, locked model selector for free tier users
- **Real-time Streaming**: Experience AI responses as they're generated
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Settings Panel**: Configure API keys and system messages
- **Message History**: View your conversation history with timestamps
- **Error Handling**: Graceful error handling with user-friendly messages
- **TypeScript**: Full type safety for better development experience

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Your FastAPI backend running on port 8000

### Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Production Build

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Preview the build:**
   ```bash
   npm run preview
   ```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **From the project root, run:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:8000`

### Manual Docker Build

1. **Build the frontend image:**
   ```bash
   docker build -t ai-chat-frontend .
   ```

2. **Run the container:**
   ```bash
   docker run -p 3000:80 ai-chat-frontend
   ```

## 🎨 Customization

### Styling

The application uses CSS modules and custom CSS. Key styling files:
- `src/index.css` - Global styles and variables
- `src/App.css` - App component styles
- `src/components/*.css` - Component-specific styles

### Configuration

- **API Endpoint**: Configured in `vite.config.ts` with proxy to backend
- **Port**: Default development port is 3000
- **Build Output**: Generated in `dist/` directory

## 🔧 Development

### Project Structure

```
src/
├── components/              # React components
│   ├── EntryScreen.tsx     # Guest + Google sign-in screen
│   ├── Header.tsx          # User avatar, free turns badge, logout
│   ├── ChatInterface.tsx   # Auth-aware chat interface
│   ├── SettingsModal.tsx   # Settings with free tier model locking
│   └── *.css               # Component styles
├── contexts/
│   └── AuthContext.tsx     # Authentication state management
├── AppWrapper.tsx          # Auth routing (Loading → EntryScreen → App)
├── App.tsx                 # Main application component
├── main.tsx                # Entry point: AuthProvider → AppWrapper
└── index.css               # Global styles
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features

1. Create new components in `src/components/`
2. Add corresponding CSS files
3. Import and use in `App.tsx` or other components
4. Follow TypeScript interfaces for type safety

## 🔐 Authentication

The frontend implements a complete authentication flow:

1. **AuthContext** (`src/contexts/AuthContext.tsx`)
   - Manages authentication state (session, user info, free turns)
   - Provides auth methods (guest login, Google login, logout)
   - Handles session persistence and restoration

2. **Entry Screen** (`src/components/EntryScreen.tsx`)
   - First screen users see
   - Offers Guest mode or Google Sign-In options
   - Uses `@react-oauth/google` for Google OAuth integration

3. **Auth-Aware Components**
   - **Header**: Shows user avatar, free turns badge, logout button
   - **ChatInterface**: Displays free turns remaining, handles turn limits
   - **SettingsModal**: Locks model selector for free tier users

4. **AppWrapper** (`src/AppWrapper.tsx`)
   - Routes between Loading → EntryScreen → App based on auth state
   - Handles session restoration on page load

### Dependencies

- **`@react-oauth/google`**: Google OAuth integration for React

## 🌐 API Integration

The frontend integrates with your FastAPI backend through:

**Authentication Endpoints:**
- `POST /api/auth/guest` - Create guest session
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/config` - Get auth configuration

**Chat Endpoints:**
- `POST /api/chat` - Streaming AI responses
- `GET /api/health` - Service status

**Features:**
- **CORS Support**: Configured for cross-origin requests
- **Streaming**: Real-time response streaming for better UX
- **Session Management**: Automatic session handling via `X-Session-ID` header

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first approach
- Flexible layouts using CSS Grid and Flexbox
- Touch-friendly interface elements
- Optimized for various screen sizes

## 🔒 Security Features

- Non-root Docker containers
- Secure headers via nginx
- API key management
- Input validation and sanitization

## 🚀 Performance

- **Vite**: Fast development and optimized builds
- **Code Splitting**: Automatic bundle optimization
- **Lazy Loading**: Components loaded on demand
- **Gzip Compression**: Enabled in production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of The AI Engineer Challenge.

---

**Happy Chatting! 🎉**