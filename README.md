# ⚙️ Relay Chat - Backend API

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Express](https://img.shields.io/badge/Express-4.21-lightgrey)
![Status](https://img.shields.io/badge/status-production--ready-green)

Production-ready backend API for Relay Chat with real-time WebSocket communication, RESTful endpoints, MongoDB database, and Redis queue processing.

---

## ✨ Features

- 🔐 JWT authentication with HTTP-only cookies
- 🔄 Real-time messaging via Socket.IO
- 📹 WebRTC signaling for video/audio calls
- 📦 MongoDB with Mongoose ODM
- 🚀 Redis + Bull queue for async message processing
- 📝 Winston logging
- 🛡️ Security: CORS, rate limiting, helmet
- ✅ Input validation with Joi
- 📁 File upload with Multer
- 🔔 Real-time presence tracking

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB and Redis URLs

# Start development server
npm run dev
```

API available at: `http://localhost:4000`

---

## 📋 Prerequisites

- Node.js v18+
- MongoDB v6+
- Redis v6+

---

## ⚙️ Environment Variables

Create `.env` file:

```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/relay-chat
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key-min-32-chars
ALLOWED_ORIGINS=http://localhost:5173
```

See `.env.example` for all options.

---

## 📜 Scripts

```bash
npm run dev      # Start with nodemon (hot reload)
npm run build    # Compile TypeScript
npm start        # Start production server
npm run lint     # Run ESLint
```

---

## 🛠 Tech Stack

- Node.js + TypeScript
- Express.js
- Socket.IO
- MongoDB + Mongoose
- Redis + Bull
- JWT + bcrypt
- Winston (logging)
- Joi (validation)
- Multer (file upload)

---

## 📁 Structure

```
src/
├── modules/              # Feature modules
│   ├── auth/            # Authentication
│   ├── conversations/   # Conversations
│   ├── messages/        # Messages
│   ├── socket/          # Socket.IO handlers
│   └── users/           # Users
├── queues/              # Bull queue processors
├── shared/              # Shared code
│   ├── constants/       # Socket events, etc.
│   ├── middleware/      # Express middleware
│   └── utils/           # Utilities
└── index.ts             # Entry point
```

---

## 🔌 API Endpoints

### Authentication

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Conversations

```
GET    /api/conversations
POST   /api/conversations
POST   /api/conversations/group
GET    /api/conversations/:id
```

### Messages

```
GET    /api/messages/:conversationId
POST   /api/messages
PUT    /api/messages/:id
DELETE /api/messages/:id
```

### Users

```
GET    /api/users
GET    /api/users/:id
PUT    /api/users/profile
```

### Upload

```
POST   /api/upload
```

---

## 🔌 Socket.IO Events

### Emitted by Backend

**Presence:** `presence:init`, `user:online`, `user:offline`

**Messages:** `message:new`, `message:sent`, `message:confirmed`, `message:delivered`, `message:read`, `message:failed`, `message:deleted`, `message:edited`

**Typing:** `typing:start`, `typing:stop`

**Reactions:** `reaction:added`, `reaction:removed`

**Conversations:** `conversation:new`

**Calls:** `call:incoming`, `call:accepted`, `call:rejected`, `call:ended`, `call:busy`

**WebRTC:** `webrtc:offer`, `webrtc:answer`, `webrtc:ice`

### Listened by Backend

**Messages:** `message:send`, `message:delete`, `message:edit`, `message:react`, `message:unreact`

**Typing:** `typing:start`, `typing:stop`

**Conversations:** `conversation:read`

**Calls:** `call:initiate`, `call:accept`, `call:reject`, `call:end`

**WebRTC:** `webrtc:offer`, `webrtc:answer`, `webrtc:ice`

---

## 🚀 Deployment

### Environment Variables

Set in production:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/relay-chat
REDIS_HOST=your-redis-host.com
JWT_SECRET=strong-random-secret-min-32-chars
ALLOWED_ORIGINS=https://your-frontend.com
```

### Build & Start

```bash
npm ci --production
npm run build
npm start
```

### Deploy to

- **Railway** (recommended): Connect GitHub repo
- **Heroku**: `heroku create && git push heroku main`
- **Render**: Connect GitHub repo
- **DigitalOcean App Platform**

### Database

**MongoDB Atlas** (recommended):

- Free tier: 512MB
- Automatic backups
- Connection string: `mongodb+srv://...`

**Redis Cloud** (recommended):

- Free tier: 30MB
- Managed service

---

## 🔐 Security

- ✅ JWT with HTTP-only cookies
- ✅ bcrypt password hashing
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ Input validation
- ✅ XSS prevention
- ✅ MongoDB injection prevention

---

## 📊 Monitoring

### Logs

Winston logger outputs to:

- Console (development)
- File: `logs/app.log` (production)

Log levels: `error`, `warn`, `info`, `debug`

### Health Check

```bash
curl http://localhost:4000/api/health
# Returns: {"status":"ok"}
```

---

## 🐛 Troubleshooting

**MongoDB connection fails:**

- Check `MONGO_URI` in `.env`
- Ensure MongoDB is running
- Check firewall/network access

**Redis connection fails:**

- Check `REDIS_HOST` and `REDIS_PORT`
- Ensure Redis is running
- Bull queue requires Redis

**Socket.IO not connecting:**

- Check CORS `ALLOWED_ORIGINS`
- Ensure frontend URL is allowed
- Check firewall

**Build fails:**

- Run `npm run build` to see TypeScript errors
- Check `tsconfig.json`

---

## 🧪 Testing

```bash
# Type checking
npm run build

# Lint
npm run lint

# Manual API testing
curl http://localhost:4000/api/health
```

---

## 📝 License

MIT License

---

**Built with ❤️ using Node.js, Express, Socket.IO, and MongoDB**
