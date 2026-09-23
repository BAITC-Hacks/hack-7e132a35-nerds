FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && chown -R node:node /app
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node scripts/restore-snapshot.mjs --if-empty && node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3000"]
