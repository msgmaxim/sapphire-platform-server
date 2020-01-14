var obj = require('./lib.platform');
var dispatcher = obj.dispatcher;
var middlewares = require('./middlewares');

/** set up express framework */
var express = require('express');
var bodyParser = require('body-parser');

// create an internal server
var internalServer = express();
internalServer.use(bodyParser.json());
internalServer.use(bodyParser.urlencoded({
  extended: true
}));
//internalServer.all('/*', corsMiddleware);
internalServer.use(middlewares.adnMiddleware);

var internal_mounts={};

internal_mounts.admin=require('./dialect.admin');
internalServer.dispatcher=dispatcher;
internal_mounts.admin(internalServer, '');

module.exports = internalServer;