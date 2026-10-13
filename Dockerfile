# ── Stage: Production image ──────────────────────────────────
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only package files first (layer caching — npm install
# only re-runs when package.json actually changes)
COPY server/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the server code
COPY server/ .

# Copy the frontend (served statically by Express)
COPY public/ ../public/

# Expose the port the app listens on
EXPOSE 3000

# Health check — Docker will restart the container if this fails
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "server.js"]
