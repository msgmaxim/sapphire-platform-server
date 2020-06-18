FROM node:12
RUN npm i -g pm2

WORKDIR /usr/src/app

COPY *.js /usr/src/app/
# can set all these through environment...
#COPY config.json /usr/src/app/config.json
COPY package.json /usr/src/app/package.json
COPY package-lock.json /usr/src/app/package-lock.json
COPY ohe/ ohe/
COPY templates/ templates/
COPY test/ test/

# this should install mocha because not --production or --only=prod
# may need --dev ?
RUN npm i

# run unit tests
RUN mocha --exit

EXPOSE 7070 3000
ENTRYPOINT ["pm2-runtime", "app.js"]
