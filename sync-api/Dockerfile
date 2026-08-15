# ---- Build stage: install + compile native deps (better-sqlite3) ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Final stage: only the runtime ----
FROM node:20-alpine
WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY server.js db.js auth.js ./

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.js"]
