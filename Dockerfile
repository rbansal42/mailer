# Build frontend
FROM oven/bun:alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# Build backend
FROM oven/bun:alpine AS backend-build
WORKDIR /app/server
COPY server/package.json server/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY server/ ./
RUN bun build src/index.ts --target=bun --outfile=server.js

# Production
FROM oven/bun:alpine
WORKDIR /app
COPY --from=backend-build /app/server/server.js ./
COPY --from=frontend-build /app/frontend/dist ./public
RUN mkdir -p /app/data
EXPOSE 3342
CMD ["bun", "run", "server.js"]
