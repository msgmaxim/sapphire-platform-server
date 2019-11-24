FROM node:12
RUN npm i -g pm2 mocha

WORKDIR /usr/src

# make sure we get the latest repo
ADD https://gitgud.io/api/v4/projects/6143/repository/commits/master version.json
RUN git clone https://gitgud.io/Sapphire/Tavrn/sapphire-platform-server.git app
WORKDIR /usr/src/app
RUN npm i

# run unit tests
RUN mocha --exit

EXPOSE 7070 3000
ENTRYPOINT ["pm2-runtime", "app.js"]
