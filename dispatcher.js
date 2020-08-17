/**
 * Dispatcher is an internal front-facing API for all functions and services
 *
 * "Dialects" will call these functions to the data-access chain to store/retrieve data and format
 * responses in standard way.
 *
 * @module dispatcher
 */

const downloader = require('./downloader.js')
const configUtil = require('./lib/lib.config.js')

/** for status reports */
var lmem = { heapUsed: 0 }

const funcs = []
funcs.push(require('./modules/users/tokens.controller'))
funcs.push(require('./modules/users/textprocess.controller'))
funcs.push(require('./modules/users/annotations.controller'))
funcs.push(require('./modules/users/entities.controller'))
funcs.push(require('./modules/users/mutes.controller'))
funcs.push(require('./modules/users/users.controller'))

funcs.push(require('./modules/clients/clients.controller'))

if (configUtil.moduleEnabled('channels')) {
  funcs.push(require('./modules/channels/channels.controller'))
  funcs.push(require('./modules/channels/messages.controller'))
  funcs.push(require('./modules/channels/subscriptions.controller'))
}

if (configUtil.moduleEnabled('files')) {
  funcs.push(require('./modules/files/files.controller'))
}
if (configUtil.moduleEnabled('follows')) {
  funcs.push(require('./modules/follows/follows.controller'))
}

if (configUtil.moduleEnabled('posts')) {
  funcs.push(require('./modules/posts/posts.controller'))
  funcs.push(require('./modules/posts/stars.controller'))
}

if (configUtil.moduleEnabled('markers')) {
  funcs.push(require('./modules/markers/streammarkers.controller'))
}

// create bus
var coreOptions = {
}
funcs.forEach((func) => {
  if (func.start) func.start(coreOptions)
})

// FIXME: make a function accessor
// so we can configure for memory or cputime
const errors = {
  noToken: new Error('no or invalid token'),
  noUser: new Error('no such user')
}

// FIXME: users list version
function normalizeUserID(input, tokenobj, callback) {
  // console.log('dispatcher::normalizeUserID', input)
  if (input === 'me') {
    if (tokenobj && tokenobj.userid) {
      // console.log('dispatcher.js::normalizeUserID - me became', tokenobj.userid)
      callback(null, tokenobj.userid)
    } else {
      callback(errors.noToken)
    }
    return
  }

  var ref = module.exports
  if (input[0] === '@') {
    // console.log('dispatcher::normalizeUserID @', input.substr(1))
    ref.cache.getUserID(input.substr(1), function(err, userobj) {
      if (err) {
        console.log('dispatcher.js::normalizeUserID err', err)
      }
      if (userobj) {
        callback(null, userobj.id)
      } else {
        callback(errors.noUser)
      }
    })
    return
  }

  // numeric
  callback(null, input)
}

if (configUtil.getLoggingPeridoticReports()) {
  const humanFormat = require('human-format')
  /** minutely status report */
  setInterval(function() {
    var ts = Date.now()
    var mem = process.memoryUsage()
    /*
    regarding: the dispatcher stdout writes (isThisDoingAnything)
    it's pretty compact, only one or two lines per minute
    so finding the exception still shouldn't be an issue
    though they will get further and further apart as the quality of the code gets better
    either case the exceptions need to be logged in a proper log file
    */
    // break so the line stands out from the instant updates
    process.stdout.write('\n')
    console.log('dispatcher @' + ts + ' Memory+[' + humanFormat(mem.heapUsed - lmem.heapUsed) + '] Heap[' + humanFormat(mem.heapUsed) + '] uptime: ' + process.uptime())
    lmem = mem
    ts = null
  }, 60 * 1000)
}

// cache is available at this.cache
// we set from API to DB format
// we get from DB format to API
// how much error checking do we need in the get callback?
// should we stop the callback on failure? probably not...
/** @constructs dispatcher */
let functions = {
  /**
   * cache object for accessing the data store
   * @type {object}
   */
  cache: null,
  /**
   * config object for app.net specific configuration
   * @type {object}
   */
  config: null,
  /**
   * app config object for accessing the config files
   * @type {object}
   */
  appConfig: null,
  /**
   * boolean option for controlling streaming output
   * @type {boolean}
   */
  notsilent: true,
  /**
   * redis connection for websocket streams
   */
  redisClient: null,
  /**
   * websocket stream pumps
   */
  pumps: {},
  name: 'originalFlavor',
  normalizeUserID: normalizeUserID,
  downloader: downloader,
  //
  // block
  //
  /** @todo block */
  /** config **/
  // change to callback style?
  getConfig: function() {
    return this.config
  },
  /** oembed **/
  getOEmbed: function(url, callback) {
    this.cache.getOEmbed(url, callback)
  },
  /** dispatcher for streamrouter */
  dispatch: function(userid, json) {
    // remember json is in app streaming format!
    // console.dir(json)
    var data = json.data
    var meta = json.meta
    // the missing meta is going to be an issue
    /*
     { meta:
       { suppress_notifications_all: false,
         timestamp: 1399812206341,
         type: 'post',
         id: '30224684',
         suppress_notifications: [] },
    */
    switch (meta.type) {
      case 'post':
        // transfer stream encoding over to normal post structure
        if (meta && meta.is_deleted) {
          if (data === undefined) data = {}
          data.is_deleted = true
        }
        if (data.id) {
          this.setPost(data)
        }
        break
      case 'channel':
        this.setChannel(data, meta.timestamp)
        break
      case 'message':
        // meta.timestamp is important here for channels
        this.setMessage(data, meta.timestamp)
        break
      case 'channel_subscription':
        this.setChannelSubscription(data, meta.is_deleted, meta.timestamp)
        break
      case 'file':
        console.log('file')
        break
      case 'stream_marker':
        console.log('stream_marker')
        break
      case 'token':
        console.log('token')
        break
      case 'star':
        this.setStar(data, meta.is_deleted, meta.id, meta.timestamp)
        break
      case 'mute':
        console.log('mute')
        break
      case 'block':
        console.log('block')
        break
      case 'user':
        this.updateUser(data, meta.timestamp)
        break
      case 'user_follow':
        if (data) {
          this.setFollows(data, meta.is_deleted, meta.id, meta.timestamp)
        } else {
          this.setFollows(null, meta.is_deleted, meta.id, meta.timestamp)
        }
        break
      default:
        console.log('dispatcher.js::dispatch - unknown appstream type [' + meta.type + ']')
        break
    }
    // done with data
    data = false
    meta = false
    json = false
  },
  pumpStreams: function(options, data) {
    // console.log('dispatcher::pumpStreams -', options)
    // op isn't used (add/del), type is only used in the meta
    function checkKey(key, op, type) {
      // console.log('dispatcher::pumpStreams - checking', key)
      // see if there's any connections we need to pump
      if (module.exports.pumps[key]) {
        // console.log('pumping', key, 'with', module.exports.pumps[key].length)
        // FIXME: by queuing all connections that data needs to be set on
        for (var i in module.exports.pumps[key]) {
          var connId = module.exports.pumps[key][i]
          // push non-db object data to connection
          // is_deleted, deleted_id
          // subscription_ids
          var wrap = {
            meta: {
              connection_id: connId,
              type: type
            },
            data: data
          }
          module.exports.streamEngine.handlePublish(connId, wrap)
        }
      }
    }
    // { id: x, type: 'post', op: 'add', actor: 153 }
    // { id: x, type: 'post', op: 'del', }
    // conver to key
    if (options.type === 'message') {
      checkKey('channel.' + options.channel_id + '.message', options.op, 'message')
    } else {
      checkKey(options.type + '.' + options.id, options.op, 'post')
      if (options.type === 'post') {
        checkKey('user.' + options.actor + '.post', options.op, 'post')
      }
    }
  }
  /**
   * This callback is displayed as part of Dispatcher class
   * @callback setPostCallback
   * @param {object} post object
   * @param {string} error
   */
  /**
   * This is a callback that passes back the meta data as well
   * @callback metaCallback
   * @param {object} post post data object
   * @param {?string} error null if no errors, otherwise string
   * @param {object} meta meta object
   */
}

funcs.forEach((func) => {
  functions = Object.assign(functions, func)
})

module.exports = functions
module.exports.start = function() {
  console.log('start stub')
}

// configure downloader
downloader.dispatcher = module.exports
