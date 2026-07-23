# MMS — single-container image for a small VPS (PLAN §1.2).
# Debian slim (glibc) so the @libsql native binary uses its linux-x64-gnu build.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# App + build output + migrations + tooling needed to migrate on boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/package.json ./package.json
# The SQLite file lives on a mounted volume (see docker-compose.yml).
RUN mkdir -p /app/data
EXPOSE 3000
# Apply any pending migrations, then serve. Migrations are idempotent.
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
