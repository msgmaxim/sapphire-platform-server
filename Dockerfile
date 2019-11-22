FROM node:12
RUN npm i -g pm2 mocha

WORKDIR /usr/src
RUN git clone https://gitgud.io/Sapphire/Tavrn/sapphire-platform-server.git app
WORKDIR /usr/src/app
RUN npm i

# run unit tests
RUN mocha --exit

EXPOSE 7070 3000
ENTRYPOINT ["pm2-runtime", "app.js"]
