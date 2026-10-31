# Build the frontend
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run: Node executes the TypeScript server directly and serves the built frontend
FROM node:26-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/data/importer.db STATIC_DIR=dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
# the certificate is self-signed, so the check doesn't verify it
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'; fetch((process.env.TLS_CERT_FILE ? 'https' : 'http') + '://127.0.0.1:3000/api/import/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/main.ts"]
