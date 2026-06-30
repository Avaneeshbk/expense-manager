# Dockerfile for the expense-manager Telegram bot.
# Compatible with: Fly.io, Hugging Face Spaces, Render, Railway, etc.
#
# The bot uses long polling (no inbound HTTP), but some platforms
# (notably Hugging Face) require the container to expose *some* port.
# We expose 8080 with a tiny health server that satisfies liveness probes
# without interfering with the bot.

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Build deps for sharp (image processing lib used by the bot's chart rendering).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# ---- Runtime stage -------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN useradd -m -u 1001 botuser
USER botuser

COPY --chown=botuser:botuser --from=deps /app/node_modules ./node_modules
COPY --chown=botuser:botuser package*.json ./
COPY --chown=botuser:botuser src ./src

# Tiny health server — satisfies platforms that require an open port
# (Hugging Face Spaces, Render, Fly.io liveness checks). The bot itself
# runs on long polling and is unaffected by this.
COPY --chown=botuser:botuser health.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "node health.js & node src/index.js"]