FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY *.mjs ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
