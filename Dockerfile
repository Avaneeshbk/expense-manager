# Multi-stage Dockerfile for the expense-manager Telegram bot.
# Output is a slim Debian image that just runs `node src/index.js` via long polling.
# No HTTP server is exposed — bots don't need one on Fly.

# ---- Stage 1: install deps in a full Node image --------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# sharp needs these build deps on Debian. Keeping them in a build stage
# keeps the final image small.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# ---- Stage 2: runtime ---------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Run as non-root for safety.
RUN useradd -m -u 1001 botuser
USER botuser

COPY --chown=botuser:botuser --from=deps /app/node_modules ./node_modules
COPY --chown=botuser:botuser package*.json ./
COPY --chown=botuser:botuser src ./src

# No EXPOSE — we're long polling, no inbound HTTP.

CMD ["node", "src/index.js"]