FROM node:latest
WORKDIR /app
COPY . .
COPY inter /usr/share/fonts/inter
RUN yarn
CMD node index.js