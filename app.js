var obj = require('./lib.platform');
var nconf = obj.nconf;
var publicRouter = require('./router.public');
var internalServer = require('./router.admin');

/**
 * Launch the server!
 */
var webport = nconf.get('web:port') || 7070;
var weblisten = nconf.get('web:listen') || '0.0.0.0';
console.log('launching public webserver on', weblisten+':'+webport);
publicRouter.listen(webport, weblisten);

var admin_modkey=nconf.get('admin:modKey');
if (admin_modkey) {
  var admin_port=nconf.get('admin:port') || 3000;
  var admin_listen=nconf.get('admin:listen') || '127.0.0.1';
  console.log('Mounting admin at / on '+admin_listen+':'+admin_port);
  internalServer.listen(admin_port, admin_listen);
} else {
  console.log("admin:modKey not set in config. No admin set up!");
}

var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';

/** set up upstream */
if (upstream_client_id!='NotSet') {
  // send events into "dispatcher"
  var stream_router = require('./ohe/streamrouter').create_router(app, dispatcher);
  // this blocks the API until connected =\
  auth.get_app_token(function (token) {
      stream_router.stream(token);
  });
} else {
  console.log("uplink:client_id not set in config. No uplink set up!");
}

// if full data store
// check caches/dates since we were offline for any missing data
// hoover users (from our last max ID to appstream start (dispatcher.first_post))
// hoover posts (from our last max ID to appstream start (dispatcher.first_post))
// hoover stars for all users in db

module.exports = {
  publicApp: publicRouter,
  hasAdminApp: admin_modkey ? true : false,
  adminApp: internalServer,
}