/**
 * Based losely off ohe
 */
var path = require('path')
var nconf = require('nconf')
var net = require('net')
/** get file io imported */
var fs = require('fs')

//var longjohn = require('longjohn')

// FIXME: need way to single out a single IP or token

// Look for a config file
var config_path = path.join(__dirname, '/config.json')
// and a model file
var config_model_path = path.join(__dirname, '/config.models.json')
console.log('config-file-path', nconf.get('config-file-path') || config_path)
if (nconf.get('config-file-path') && !fs.existsSync(nconf.get('config-file-path'))) {
  console.warn('config-file-path is set and yet missing...')
  process.exit()
}
nconf.argv().env('__').file('', nconf.get('config-file-path') || config_path )

/** ohe libs */
/** for getting app_token */
var auth = require('./ohe/auth')
/** for building app stream */
var adnstream = require('./ohe/adnstream')

/** pull configuration from config into variables */
var apiroot = nconf.get('uplink:apiroot') || 'https://api.app.net'

var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet'
var upstream_client_secret=nconf.get('uplink:client_secret') || 'NotSet'
var webport = nconf.get('web:port') || 7070
var api_client_id= nconf.get('web:api_client_id') || ''

var auth_base=nconf.get('auth:base') || 'https://account.app.net/oauth/'
var auth_client_id=nconf.get('auth:client_id') || upstream_client_id
var auth_client_secret=nconf.get('auth:client_secret') || upstream_client_secret

var admin_port=nconf.get('admin:port') || 3000
var admin_listen=nconf.get('admin:listen') || '127.0.0.1'
var admin_modkey=nconf.get('admin:modKey')

var octets=admin_listen.split('.')
if (net.isIPv4(octets)) {
  if (octets[0] != '127' && octets[0] != '10' && octets[0] != '172' && octets[0] != '192') {
    console.error('Cannot listen on',admin_listen,'private or loopback only!', octets)
    admin_listen='127.0.0.1'
  }
} else {
  // FIXME: resolve it and then run the check
}

// Todo: make these modular load modules from config file

// Todo: general parameters
// Todo: expiration models and configuration

// Todo: end error object
var proxy = null
if (upstream_client_id!='NotSet') {
  proxy = require('./dataaccess.proxy.js')
}
var db=require('./dataaccess/dataaccess.caminte.js')
db.start(nconf)
var cache=require('./dataaccess/dataaccess.base.js')
var dispatcher=require('./dispatcher.js')
var streamEngine = false
if (nconf.get('stream:host')) {
  streamEngine = require('./streams.js')
}
var dialects=[]
// Todo: message queue

// initialize chain
if (proxy) db.next=proxy
cache.next=db
dispatcher.cache=cache
dispatcher.notsilent=!(nconf.get('uplink:silent') || false)
dispatcher.appConfig = {
  provider: nconf.get('pomf:provider') || 'pomf.cat',
  provider_url: nconf.get('pomf:provider_url') || 'https://pomf.cat/',
}

console.log('configuring app as', dispatcher.appConfig)
// app.net defaults
dispatcher.config=nconf.get('dataModel:config') || {
  "text": {
    "uri_template_length": {
      "post_id": 9,
      "message_id": 12
    }
  },
  "user": {
    "annotation_max_bytes": 8192,
    "text_max_length": 256
  },
  "file": {
    "annotation_max_bytes": 8192
  },
  "post": {
    "annotation_max_bytes": 8192,
    "text_max_length": 256
  },
  "message": {
    "annotation_max_bytes": 8192,
    "text_max_length": 2048
  },
  "channel": {
    "annotation_max_bytes": 8192
  }
}
console.log('configuring adn settings as', dispatcher.config)

if (proxy) {
  // set up proxy object
  proxy.apiroot=apiroot
  proxy.dispatcher=dispatcher // upload dispatcher
}

if (streamEngine) {
  // enable stream daemon
  dispatcher.streamEngine = streamEngine
  streamEngine.cache = cache
  streamEngine.dispatcher = dispatcher
  // set up redis
  streamEngine.init({
    host: nconf.get('stream:host'),
    port: nconf.get('stream:port') || 6379,
  })
}

module.exports = {
  cache: cache,
  dispatcher: dispatcher,
  proxy: proxy,
  streamEngine: streamEngine,
  nconf: nconf,
}
