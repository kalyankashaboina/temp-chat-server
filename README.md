# Relay Chat - Backend API

Real-time messaging platform backend with WebRTC, message search, and group management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev

# Server starts on http://localhost:4000
```

## 📋 Prerequisites

- Node.js 20.x+
- MongoDB 7.x
- Redis 7.x

## ⚙️ Environment Variables

```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/relay-chat
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
```

## 📝 Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm start` - Start production
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm run type-check` - TypeScript check

## 🐳 Docker

```bash
# Development (Redis only)
docker-compose -f docker-compose.dev.yml up

# Production (full stack from root)
cd .. && docker-compose up
```

## 📡 Key Features

✅ Real-time messaging with Socket.IO
✅ JWT authentication  
✅ WebRTC video/audio signaling
✅ Full-text message search
✅ Group management (add/remove members)
✅ Mute/archive conversations
✅ File uploads with Cloudinary
✅ Link preview extraction
✅ Typing indicators & read receipts

## 🔌 API Endpoints

See `test-new-features.js` or import `Relay_Chat_v1.1.0_New_Features.postman_collection.json`

## 📊 CI/CD

GitHub Actions configured:
- **CI**: Lint, type-check, build, Docker
- **CD**: Auto-deploy on push to main

## 📄 License

ISC
