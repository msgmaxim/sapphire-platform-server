/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
const callbacks   = require('./dialect.appdotnet_official.callbacks.js');
const ratelimiter = require('./ratelimiter.js');

// for pomf support
var request = require('request');
var multer  = require('multer');
var storage = multer.memoryStorage()

// post structure, good enough to fool alpha
const notimplemented=[{
  id: 0,
  text: 'not implemented',
  created_at: '2014-10-24T17:04:48Z',
  source: {

  },
  user: {
    id: 0,
    username: 'notimplemented',
    created_at: '2014-10-24T17:04:48Z',
    avatar_image: {
      url: 'https://d2rfichhc2fb9n.cloudfront.net/image/5/OhYk4yhX3u0PFdMTqIrtTF6SgOB7InMiOiJzMyIsImIiOiJhZG4tdXNlci1hc3NldHMiLCJrIjoiYXNzZXRzL3VzZXIvZTEvMzIvMjAvZTEzMjIwMDAwMDAwMDAwMC5wbmciLCJvIjoiIn0?h=80&w=80'
    },
    cover_image: {
      url: 'https://d2rfichhc2fb9n.cloudfront.net/image/5/sz0h_gbdbxI14RcO12FPxO5nSbt7InMiOiJzMyIsImIiOiJhZG4tdXNlci1hc3NldHMiLCJrIjoiYXNzZXRzL3VzZXIvNjIvMzIvMjAvNjIzMjIwMDAwMDAwMDAwMC5wbmciLCJvIjoiIn0?w=862'
    },
    counts: {
      following: 0,
    }
  }
}]

/**
 * Set up defined API routes at prefix
 */
module.exports = function(app, prefix) {
  const dispatcher = app.dispatcher;
  app.callbacks    = callbacks
  app.ratelimiter  = ratelimiter
  var nconf      = app.nconf;
  var upload     = multer({ storage: storage, limits: { fileSize: app.config.maxUploadSize } });

  /*
   * Authenticated endpoints
   */
  app.get(prefix+'/config', function(req, resp) {
    // just call the callback directly. err and meta are optional params
    callbacks.dataCallback(resp)(false, dispatcher.getConfig())
  })
  app.get(prefix+'/oembed', function(req, resp) {
    // never any meta
    dispatcher.getOEmbed(req.query.url, callbacks.oembedCallback(resp))
  })
  // channels
  require('./modules/channels/channels.routes').mount(prefix, app)
  require('./modules/channels/messages.routes').mount(prefix, app)
  require('./modules/channels/subscriptions.routes').mount(prefix, app)
  // clients
  // files
  require('./modules/files/files.routes').mount(prefix, app)
  // follows
  require('./modules/follows/follows.routes').mount(prefix, app)
  // markers
  require('./modules/markers/streammarkers.routes').mount(prefix, app)
  // posts
  require('./modules/posts/posts.routes').mount(prefix, app)
  require('./modules/posts/stars.routes').mount(prefix, app)
  // streams
  // users
  require('./modules/users/mutes.routes').mount(prefix, app)
  require('./modules/users/tokens.routes').mount(prefix, app)
  require('./modules/users/textprocess.routes').mount(prefix, app)
  require('./modules/users/users.routes').mount(prefix, app)
}
