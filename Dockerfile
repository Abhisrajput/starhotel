# One image for every cloud: API + built UI, configured only by environment.
# Build:  docker build -t audit-platform .
# Run:    docker run -p 8080:8080 -e SEED_DEMO=true audit-platform

FROM node:22-alpine AS build
WORKDIR /src
COPY backend/package*.json backend/
RUN cd backend && npm ci
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY backend backend
COPY frontend frontend
RUN cd backend && npm run build && npm prune --omit=dev
RUN cd frontend && npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/public \
    STORAGE=json \
    DATA_FILE=/app/data/db.json
WORKDIR /app
COPY --from=build /src/backend/package.json ./
COPY --from=build /src/backend/node_modules ./node_modules
COPY --from=build /src/backend/dist ./dist
COPY --from=build /src/backend/packs ./packs
COPY --from=build /src/backend/validation ./validation
COPY --from=build /src/backend/tests ./tests
COPY --from=build /src/frontend/dist ./public
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
