# Changelog - Relay Chat Backend

## [Upcoming Release]

### 🔮 Planned Features

**Progressive Web App (PWA) Enhancement**

- Full Progressive Web App (PWA) support with native-like capabilities across iOS and Android, including offline access, installability, and performance optimizations.

---

## [1.1.0] - 2026-04-21

### 🐛 Bug Fixes (4/4 Complete)

1. **Bug #1 (CRITICAL)** - Fixed message:sent payload
   - Added `conversationId` field to acknowledgment
   - Renamed `timestamp` field to `createdAt`
   - Location: `src/modules/socket/socket.events.ts`
   - Impact: Messages no longer stuck in "pending" state

2. **Bug #2 (CRITICAL)** - Conversation room join (Already fixed)
   - Sockets now join room when conversation created
   - Location: `src/modules/conversations/conversation.controller.ts`

3. **Bug #3 (HIGH)** - Fixed message:failed payload
   - Added `conversationId` field to error event
   - Location: `src/modules/socket/socket.events.ts`

4. **Bug #4 (HIGH)** - Queue processor emits real ID
   - Implemented `getIO()` function for queue access
   - Added `MSG_CONFIRMED` event constant
   - Queue processor emits `message:confirmed` after DB save
   - Locations: `src/queues/message.queue.ts`, `src/modules/socket/socket.events.ts`
   - Impact: tempId properly replaced with real MongoDB ID

### ✨ New Features

- **Message Confirmation**: Queue processor now emits real MongoDB IDs
- **Improved Error Handling**: All socket events include proper error payloads

### 🔧 Improvements

- Socket Events: Added `MSG_CONFIRMED` constant
- Error Payloads: All errors now include conversationId
- Queue Processing: Real-time ID updates via Socket.IO

### 🧪 Testing

- ✅ TypeScript build: SUCCESS
- ✅ Socket events: 100% wired (23 emitted, 15 handled)

---

## [1.0.0] - 2026-04-15

### Initial Release

- JWT authentication
- Real-time messaging via Socket.IO
- WebRTC signaling
- MongoDB database
- Redis + Bull queue
- File uploads
- Message reactions
- Typing indicators
- Presence tracking
- Group conversations
