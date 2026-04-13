# ── Stage 1: Install production dependencies ──────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime image ────────────────────────────────────────
FROM node:22-alpine AS runtime

# Install ffmpeg (brings ffprobe) and latest yt-dlp via pip
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip3 install --break-system-packages --upgrade yt-dlp

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy deps from stage 1 and app source
COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./

# Pre-create writable temp dirs with correct ownership
RUN mkdir -p downloads uploads && \
    chown -R appuser:appgroup /app

USER appuser

# Runtime environment (overridable via Dokploy env vars)
ENV NODE_ENV=production \
    PORT=3000 \
    YTDLP_BIN=/usr/bin/yt-dlp \
    FFMPEG_BIN=/usr/bin/ffmpeg \
    DOWNLOADS_DIR=downloads \
    UPLOADS_DIR=uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server/app.js"]
