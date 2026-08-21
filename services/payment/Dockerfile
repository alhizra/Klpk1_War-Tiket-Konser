FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3003
EXPOSE 3003
CMD ["node", "index.js"]
