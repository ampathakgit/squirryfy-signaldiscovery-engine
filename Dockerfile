# Stage 1: Build the Next.js application
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run the Next.js application
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Python agent source files
COPY --from=builder /app/squirryfy-content-agent ./squirryfy-content-agent

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Python, setup virtual environment, install requirements, and Playwright chromium + system dependencies
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv curl && \
    python3 -m venv /app/squirryfy-content-agent/.venv && \
    /app/squirryfy-content-agent/.venv/bin/pip install --no-cache-dir -r /app/squirryfy-content-agent/requirements.txt && \
    /app/squirryfy-content-agent/.venv/bin/playwright install-deps chromium && \
    mkdir -p /ms-playwright && \
    /app/squirryfy-content-agent/.venv/bin/playwright install chromium && \
    chown -R nextjs:nodejs /app/squirryfy-content-agent && \
    chown -R nextjs:nodejs /ms-playwright && \
    rm -rf /var/lib/apt/lists/*

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
