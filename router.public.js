var obj = require('./lib/lib.platform.js')
var dispatcher = obj.dispatcher
var nconf = obj.nconf
var middlewares = require('./middlewares.js')

/** set up express framework */
var bodyParser = require('body-parser')
var express = require('express')
var app = express()

// temporary hack middleware for debugging
// app.all('/*', middlewares.debugMiddleware);

app.config = {
  maxUploadSize: nconf.get('limits:default:max_file_size') || 100 * 1024 * 1024
}

/** need this for POST parsing */
// heard this writes to /tmp and doesn't scale.. need to confirm if current versions have this problem
app.use(bodyParser.json({
  limit: app.config.maxUploadSize * 2 // because of the encoding, we need to increase this...
}))
app.use(bodyParser.urlencoded({
  extended: true,
  limit: app.config.maxUploadSize * 2
}))
app.all('/' + '*', middlewares.corsMiddleware)
app.use(middlewares.adnMiddleware)
// app.use(middlewares.debugMiddleware);

/**
 * support both styles of calling API
 */
var apiroot = nconf.get('uplink:apiroot') || 'https://api.app.net'
app.apiroot = apiroot
app.dispatcher = dispatcher
app.nconf = nconf
console.log('router.public - maxUploadSize', app.config.maxUploadSize.toLocaleString(), 'bytes')

/* load dialects from config */
// console.log('nconf', nconf.get('web:mounts'));
var mounts = nconf.get('web:mounts') || [
  {
    destination: '',
    dialect: 'appdotnet_official'
  },
  {
    destination: '/stream/0',
    dialect: 'appdotnet_official'
  }
]
// console.log('mounts', mounts);
var dialects = {}
for (var i in mounts) {
  var mount = mounts[i]
  // key by code path
  // require already guards this..
  if (dialects[mount.dialect] === undefined) {
    // load dialect
    console.log('router.public - Loading dialect', mount.dialect)
    // if has a directory
    if (mount.dialect.match(/\.\.|\//)) {
      dialects[mount.dialect] = require(mount.dialect + '.js')
    } else {
      dialects[mount.dialect] = require('./dialect.' + mount.dialect + '.js')
    }
  }
  console.log('router.public - Mounting', mount.dialect, 'at', mount.destination + '/')
  dialects[mount.dialect](app, mount.destination)
}

// config app (express framework)
var upstream_client_id = nconf.get('uplink:client_id') || 'NotSet'
var upstream_client_secret = nconf.get('uplink:client_secret') || 'NotSet'
var auth_client_id = nconf.get('auth:client_id') || upstream_client_id
var auth_client_secret = nconf.get('auth:client_secret') || upstream_client_secret
var webport = nconf.get('web:port') || 7070
// outgoing
var auth_base = nconf.get('auth:base') || 'https://account.app.net/oauth/'
// incoming
// can it be mounted else where?
// 'http://'+req.headers.host+'/oauth/redirect_uri'
var auth_callback = nconf.get('web:public_url') + '/oauth/redirect_uri'

app.upstream_client_id = upstream_client_id
app.upstream_client_secret = upstream_client_secret
app.auth_client_id = auth_client_id
app.auth_client_secret = auth_client_secret
app.webport = webport

// only can proxy if we're set up as a client or an auth_base not app.net
if (!upstream_client_id || upstream_client_id !== 'NotSet' || auth_base !== 'https://account.app.net/oauth/') {
  console.log('router.public - upstream_client_id', upstream_client_id)
  var oauthproxy = require('./routes.oauth.proxy.js')
  console.log('router.public - auth_base     :', auth_base)
  console.log('router.public - auth_callback :', auth_callback)
  oauthproxy.auth_callback = auth_callback
  oauthproxy.auth_base = auth_base
  oauthproxy.setupoauthroutes(app, obj.cache)
} else {
  // no proxy
  // does this mean no auth?
  const generateToken = function(string_length) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
    var randomstring = ''
    for (var x = 0; x < string_length; x++) {
      var letterOrNumber = Math.floor(Math.random() * 2)
      if (letterOrNumber === 0) {
        var newNum = Math.floor(Math.random() * 9)
        randomstring += newNum
      } else {
        var rnum = Math.floor(Math.random() * chars.length)
        randomstring += chars.substring(rnum, rnum + 1)
      }
    }
    return randomstring
  }
  app.get('/oauth/authenticate', function(req, resp) {
    resp.redirect(req.query.redirect_uri + '#access_token=' + generateToken())
  })
}

module.exports = app
