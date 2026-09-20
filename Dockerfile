FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOMEPAGE_CONFIG_DIR=/config
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist /app/dist
COPY --from=build /app/dist-server /app/dist-server
EXPOSE 3000
VOLUME ["/config", "/data"]
CMD ["node", "dist-server/index.js"]
