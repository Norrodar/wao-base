FROM node:20-bookworm AS build
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install --only=production=false
RUN cd frontend && npm install --only=production=false
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
RUN adduser --system app && chown -R app:app /app
USER app
EXPOSE 8080
CMD ["node", "dist/server.js"]
