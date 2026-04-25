#!/usr/bin/env sh
set -e

echo "======================================"
echo "🚀 BACKEND LOCAL CI CHECK STARTED"
echo "======================================"

echo ""
echo "📦 Installing dependencies..."
npm ci

echo ""
echo "🔍 Running ESLint..."
npm run lint

echo ""
echo "🎨 Checking Prettier..."
npm run format:check

echo ""
echo "🧠 Running TypeScript check..."
npm run type-check

echo ""
echo "🏗️ Building backend..."
npm run build

echo ""
echo "🐳 Building Docker image..."
docker build -t relay-chat-backend:local .

echo ""
echo "📦 Checking build output..."
du -sh dist/ || echo "dist not found"

echo ""
echo "✅ BACKEND CHECK PASSED"
echo "======================================"