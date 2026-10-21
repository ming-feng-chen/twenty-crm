FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

USER node
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=64
CMD ["node", "src/main.mjs"]
