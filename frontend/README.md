# 🤖 AI Chat Frontend

A modern, responsive web frontend for the AI Chat API built with React, TypeScript, and Vite. This beautiful chat interface integrates seamlessly with your FastAPI backend to provide an amazing user experience for AI-powered conversations.

## ✨ Features

- **Modern UI/UX**: Beautiful glassmorphism design with smooth animations
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
├── components/          # React components
│   ├── Header.tsx      # Application header
│   ├── ChatInterface.tsx # Main chat component
│   └── *.css          # Component styles
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
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

## 🌐 API Integration

The frontend integrates with your FastAPI backend through:

- **Chat Endpoint**: `/api/chat` for streaming AI responses
- **Health Check**: `/api/health` for service status
- **CORS Support**: Configured for cross-origin requests
- **Streaming**: Real-time response streaming for better UX

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