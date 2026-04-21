FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/dist dist
COPY --from=builder /app/package*.json .
COPY --from=builder /app/filehub.docker.yml filehub.yml

RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /app/node_modules/.cache

EXPOSE 6543

CMD ["node", "dist/main/web-server.cjs"]
