FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3004
EXPOSE 3004
CMD ["node", "index.js"]
