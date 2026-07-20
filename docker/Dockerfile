FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

FROM node:22-alpine
WORKDIR /app
RUN apk update && apk upgrade --no-cache
COPY --from=builder --chown=node:node /app ./
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-v* 2>/dev/null || true
USER node
EXPOSE 5001
CMD ["node", "server.js"]
