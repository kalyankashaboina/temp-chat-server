# ================================
# STAGE 1: Build (TypeScript → JS)
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

# Disable husky & scripts in Docker
ENV HUSKY=0

# Install deps exactly from lockfile
COPY package*.json ./
RUN npm ci

# Copy source & config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build


# ================================
# STAGE 2: Runtime (Production)
# ================================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HUSKY=0

# Install ONLY production deps, ignore scripts
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (matches PORT in .env)
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
