# Build context = root repo (lihat docker-compose build.context)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
COPY data ./data
COPY db ./db
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
