# 🚀 Relay Chat Backend

Real-time chat backend with WebSocket support, Redis caching, and async message queues.

## 🎯 Quick Start

### Auto-Setup (Recommended)

```bash
chmod +x dev.sh
./dev.sh
```

### Manual Setup

```bash
# 1. Start Docker services
docker-compose -f docker-compose.dev.yml up -d

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```

## 📦 Prerequisites

- Node.js 20+
- Docker & Docker Compose

## 🗄️ Seed Test Data

```bash
npm run seed
```

**Test Users:** alice@test.com, bob@test.com (password123)

## 🌐 Environment (.env)

```bash
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/relay-chat
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-secret
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=debug
```

## 🔧 Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run type-check   # TypeScript check
npm run seed         # Seed database
```

## 🐳 Docker

```bash
# Start MongoDB + Redis
docker-compose -f docker-compose.dev.yml up -d

# Stop
docker-compose -f docker-compose.dev.yml down
```

## ✅ Features

- JWT Authentication
- Real-time messaging (Socket.IO)
- Redis caching
- Async DB writes (Bull queues)
- Idempotency layer
- Pino logger
- FREE WebRTC (STUN)

---

**Backend for Relay Chat**
