# ===============================
# Frontend Build Stage
# ===============================
FROM node:20-slim AS client-build

WORKDIR /app/client

# Install frontend deps (cache layer)
COPY client/package.json ./
RUN npm install

# Copy source and build
COPY client .
RUN npm run build


# ===============================
# Runtime Stage
# ===============================
FROM node:20-slim

WORKDIR /app

# Install curl (for healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# -------------------------------
# Backend Dependencies
# -------------------------------
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Copy backend source
COPY server ./

# -------------------------------
# Copy Built Frontend
# -------------------------------
COPY --from=client-build /app/client/dist ./public

# -------------------------------
# Persistent DB Directory
# -------------------------------
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DB_PATH=/data/labels.db

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["node", "server.js"]

