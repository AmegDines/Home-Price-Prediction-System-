# =============================================================================
# Stage 1 — Dependencies
# Install node_modules separately so they are cached between code changes.
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# =============================================================================
# Stage 2 — Builder
# Build the Next.js production bundle.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build-time env: backend URL is injected here so the browser bundle bakes it in
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build

# =============================================================================
# Stage 3 — Runtime
# Minimal production image — only the .next standalone output.
# =============================================================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Non-root user (Unit V — DevSecOps)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

ENV NODE_ENV=production
ENV PORT=3000

# Next.js standalone output includes server.js + minimal node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
