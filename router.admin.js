var obj = require('./lib/lib.platform.js');
var dispatcher = obj.dispatcher;
var middlewares = require('./middlewares.js');

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
//internalServer.use(middlewares.debugMiddleware);

var internal_mounts={};

internal_mounts.admin=require('./dialect.admin');
internalServer.dispatcher=dispatcher;
internal_mounts.admin(internalServer, '');

module.exports = internalServer;
