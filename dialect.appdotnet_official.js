/**
This module takes the API and communicates with the front-end internal API (dispatcher)
to provide data
this file is responsible for the dialect for the associate mountpoint

we're responsible for filteirng models to make sure we only return what matches the dialect's spec
*/
const callbacks = require('./dialect.appdotnet_official.callbacks.js')
const ratelimiter = require('./ratelimiter.js')
const configUtil = require('./lib/lib.config.js')

/**
 * Set up defined API routes at prefix
 */
module.exports = function(app, prefix) {
  const dispatcher = app.dispatcher
  app.callbacks = callbacks
  app.ratelimiter = ratelimiter

  /*
   * Authenticated endpoints
   */
  app.get(prefix + '/config', function(req, resp) {
    // just call the callback directly. err and meta are optional params
    callbacks.dataCallback(resp)(false, dispatcher.getConfig())
  })
  app.get(prefix + '/oembed', function(req, resp) {
    // never any meta
    dispatcher.getOEmbed(req.query.url, callbacks.oembedCallback(resp))
  })
  // channels
  if (configUtil.moduleEnabled('channels')) {
    require('./modules/channels/channels.routes').mount(prefix, app)
    require('./modules/channels/messages.routes').mount(prefix, app)
    require('./modules/channels/subscriptions.routes').mount(prefix, app)
  }
  // clients
  // files
  if (configUtil.moduleEnabled('files')) {
    require('./modules/files/files.routes').mount(prefix, app)
  }
  // follows
  if (configUtil.moduleEnabled('follows')) {
    require('./modules/follows/follows.routes').mount(prefix, app)
  }
  // markers
  if (configUtil.moduleEnabled('markers')) {
    require('./modules/markers/streammarkers.routes').mount(prefix, app)
  }
  // posts
  if (configUtil.moduleEnabled('posts')) {
    require('./modules/posts/posts.routes').mount(prefix, app)
    require('./modules/posts/stars.routes').mount(prefix, app)
  }
  // streams
  if (configUtil.moduleEnabled('streams')) {
  }
  // users
  require('./modules/users/tokens.routes').mount(prefix, app)
  require('./modules/users/users.routes').mount(prefix, app)
  require('./modules/users/mutes.routes').mount(prefix, app)
  require('./modules/users/textprocess.routes').mount(prefix, app)
}
