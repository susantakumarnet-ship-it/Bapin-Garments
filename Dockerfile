# Single-container build: React storefront + admin (static) served by the Express API.
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=client /app/client/dist ./client/dist
RUN apk add --no-cache postgresql16-client
EXPOSE 4000
CMD ["node", "server/src/index.js"]
