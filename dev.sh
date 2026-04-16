#!/bin/bash

# Backend Development Startup Script
# Starts ONLY Redis in Docker
# MongoDB runs locally (MongoDB Compass) or Atlas
# Backend runs on host with hot-reload

echo "===================================="
echo "  Relay Chat Backend Development"
echo "===================================="
echo ""

# Start Docker Redis
echo "[1/3] Starting Redis in Docker..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for Redis to be ready
echo "[2/3] Waiting for Redis to be ready..."
sleep 3

# Check if Redis is running
if ! docker ps | grep -q "relay-chat-redis-dev"; then
    echo "ERROR: Redis failed to start!"
    echo "Run: docker-compose -f docker-compose.dev.yml logs"
    exit 1
fi

echo "[SUCCESS] Redis ready on localhost:6379"
echo ""
echo "MongoDB Setup:"
echo "  - Option 1: Local MongoDB Compass (localhost:27017)"
echo "  - Option 2: MongoDB Atlas (update MONGO_URI in .env)"
echo ""
echo "Current MONGO_URI: $(grep MONGO_URI .env | cut -d'=' -f2)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "[3/3] Installing dependencies..."
    npm install
else
    echo "[3/3] Dependencies already installed"
fi

echo ""
echo "===================================="
echo "  Starting Backend Server..."
echo "===================================="
echo ""
npm run dev
