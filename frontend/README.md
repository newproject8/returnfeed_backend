# ReturnFeed Frontend

React-based frontend application for ReturnFeed cloud-native live production platform.

## 🚀 Features

- **Live Video Production Interface**: Multi-camera switching with real-time preview
- **Tally System Integration**: Visual, audio, and vibration feedback for camera operators
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Real-time WebSocket Communication**: Instant updates for all participants
- **OAuth Integration**: Secure Google sign-in support
- **Modern UI/UX**: Clean, professional interface optimized for live production

## 🛠️ Technology Stack

- **React 19.1.0** - UI framework
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing
- **HLS.js** - HTTP Live Streaming playback
- **WebRTC** - Real-time communication
- **CSS Modules** - Scoped styling

## 📋 Prerequisites

- Node.js 20+ and npm/yarn
- Modern web browser with WebRTC support
- Backend API server running

## 🔧 Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required environment variables:
   ```
   VITE_API_URL=http://localhost:3000
   VITE_WS_URL=ws://localhost:8765
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── Auth.tsx      # Authentication forms
│   │   ├── Dashboard.tsx # Main production interface
│   │   ├── VideoPlayer.tsx # WebRTC/HLS video player
│   │   ├── TallyOverlay.tsx # Tally feedback system
│   │   └── Layout/       # Layout components
│   ├── context/          # React Context providers
│   │   └── AuthContext.tsx # Authentication state
│   ├── hooks/            # Custom React hooks
│   │   ├── useWebSocket.ts # WebSocket connection
│   │   ├── useTallyFeedback.ts # Tally system logic
│   │   └── useSpeechSynthesis.ts # Audio feedback
│   ├── pages/            # Page components
│   │   └── Landing.tsx   # Landing page
│   ├── styles/           # Global styles
│   └── App.tsx          # Main application component
├── public/              # Static assets
└── index.html          # HTML entry point
```

## 🎨 Key Components

### Dashboard
The main production interface where users can:
- View multiple camera feeds
- Switch between cameras
- Monitor tally status
- Manage production sessions

### VideoPlayer
Handles both WebRTC and HLS video playback with:
- Automatic protocol selection
- Error handling and retry logic
- Low-latency optimization

### TallyOverlay
Provides multi-modal feedback:
- Red border for on-air status
- Green border for preview
- Audio announcements
- Vibration feedback (mobile)

### Auth Components
Handles user authentication:
- Email/password login
- Google OAuth integration
- Session management

## 🔌 API Integration

The frontend communicates with the backend through:
- RESTful API endpoints (authenticated with JWT)
- WebSocket for real-time updates
- Media endpoints for video streaming

## 🎯 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow React best practices and hooks patterns
- Implement proper error boundaries
- Write meaningful component and variable names

### State Management
- Use React Context for global state
- Keep component state local when possible
- Implement proper loading and error states

### Performance
- Lazy load components where appropriate
- Optimize re-renders with React.memo
- Use proper dependency arrays in hooks
- Implement code splitting for routes

## 🧪 Testing

Run tests with:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📦 Building for Production

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Preview production build**
   ```bash
   npm run preview
   ```

3. **Output**
   The built files will be in the `dist/` directory, ready to be served by a web server.

## 🚀 Deployment

The frontend is designed to be served by NGINX in the Docker setup:

1. Build the frontend
2. Copy `dist/` contents to NGINX serving directory
3. Ensure NGINX is configured to proxy API requests to the backend

## 🐛 Troubleshooting

### Video not playing
- Check WebRTC connection in browser console
- Verify media server is accessible
- Ensure proper CORS headers

### WebSocket connection issues
- Verify WebSocket URL in environment variables
- Check for proxy/firewall blocking WebSocket connections
- Ensure backend WebSocket server is running

### Authentication problems
- Clear browser localStorage
- Verify Google OAuth client ID
- Check backend JWT configuration

## 🤝 Contributing

1. Follow the existing code style
2. Write meaningful commit messages
3. Test your changes thoroughly
4. Update documentation as needed

## 📄 License

This project is part of ReturnFeed and follows the same license terms.

---

_Last updated: July 15, 2025_