// build actual stream and consumer factory
// can push events to consumer
var nconf = require('nconf')
var request = require('request')
var _ = require('underscore')
var ADNStream = require('./adnstream').ADNStream

var api_url_base = nconf.get('adn:api_url_base') || 'https://alpha-api.app.net'
// There are some comments in auth.js which explain this mess
var api_host_override = nconf.get('adn:api_host_override') || 'alpha-api.app.net'

var key = nconf.get('adn:stream_key') || 'uplink_stream'
// this number has to be in quotes otherwise it won't match
var filter_id = nconf.get('adn:stream_filter_id') || '859'

// Constructor
function StreamRouter(app, consumer) {
  this.app = app
  this.consumer = consumer
}

StreamRouter.prototype.get_or_create_stream = function(app_access_token, cb) {
  var stream_url = api_url_base + '/stream/0/streams'

  var headers = {
    authorization: 'Bearer ' + app_access_token,
    host: api_host_override
  }

  var stream_template = {
    object_types: ['post', 'message', 'channel', 'stream_marker', 'channel_subscription', 'user_follow', 'star', 'mute', 'block', 'token', 'file', 'user'],
    type: 'long_poll',
    key: key,
    filter_id: filter_id
  }

  var create_stream = function() {
    request.post({
      url: stream_url,
      headers: headers,
      json: stream_template
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        console.log('created stream id ' +  body.data.id)
        cb(body.data.endpoint)
      } else {
        console.log('Error getting creating stream', e, 'status', r.statusCode, 'body', body)
        cb()
      }
    })
  }

  request.get({
    url: stream_url,
    qs: {
      key: key
    },
    headers: headers
  }, function(e, r, body) {
    if (!e && r.statusCode === 200) {
      var obj = JSON.parse(body)
      if (obj.data.length) {
        var stream = obj.data[0]
        var found_stream = _.pick(stream, _.keys(stream_template))
        found_stream.filter_id = stream.filter && stream.filter.id

        if (_.isEqual(found_stream, stream_template)) {
          console.log('reusing stream id', stream.id)
          cb(stream.endpoint)
        } else {
          // delete stream so we can recreate it with correct template
          request.del({
            url: stream_url + '/' + stream.id,
            headers: headers
          }, function(e, r, body) {
            if (!e && r.statusCode === 200) {
              create_stream()
            } else {
              console.log('Error deleting stream ' + stream.id)
              cb()
            }
          })
        }
      } else {
        create_stream()
      }
    } else {
      console.log('Error getting stream', e, 'status', r.statusCode, 'body', body)
      cb()
    }
  })
}

// handle stream method
StreamRouter.prototype.stream = function(token) {
  var self = this

  var listen_to_endpoint = function(app_token, endpoint) {
    var stream = new ADNStream(endpoint)

    // by using events, the main event loop is not blocked

    // set up all event emitter event listener
    stream.on('channel', function(msg) {
      _.each(msg.meta.subscribed_user_ids, function(user_id) {
        self.consumer.dispatch(user_id, msg)
      })
    })

    stream.on('message', function(msg) {
      _.each(msg.meta.subscribed_user_ids, function(user_id) {
        self.consumer.dispatch(user_id, msg)
      })
    })

    stream.on('post', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      // data isn't always set
      if (msg.data && msg.data.user) {
        self.consumer.dispatch(msg.data.user.id, msg)
      } else {
        self.consumer.dispatch(null, msg)
      }
      //});
    })

    stream.on('user_follow', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      // Data isn't always defined, it's all meta
      if (msg.data && msg.data.user) {
        // this should be right
        self.consumer.dispatch(msg.data.user.id, msg)
      } else {
        console.log('What happened to data.user.id?')
        console.dir(msg.data)
        self.consumer.dispatch(null, msg)
      }
      //});
    })

    stream.on('star', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      if (msg.data && msg.data.user) {
        self.consumer.dispatch(msg.data.user.id, msg)
      } else {
        self.consumer.dispatch(null, msg)
      }
      //});
    })

    stream.on('mute', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      self.consumer.dispatch(msg.data.user.id, msg)
      //});
    })

    stream.on('block', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      self.consumer.dispatch(msg.data.user.id, msg)
      //});
    })

    stream.on('token', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      self.consumer.dispatch(msg.data.user.id, msg)
      //});
    })

    stream.on('file', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      self.consumer.dispatch(msg.data.user.id, msg)
      //});
    })

    stream.on('user', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      if (msg.data.user) {
        self.consumer.dispatch(msg.data.user.id, msg)
      } else {
        self.consumer.dispatch(0, msg)
      }
      //});
    })

    stream.on('user_follow', function(msg) {
      //_.each(msg.meta.subscribed_user_ids, function (user_id) {
      // or do we look up everyone that's following this user?
      if (msg.data) {
        self.consumer.dispatch(msg.data.user.id, msg)
      } else {
        self.consumer.dispatch(null, msg)
        console.log('ohe:::streamrouter.js::stream:listen_to_endpoint.user_follow - no data in msg', msg)
        /*
                 { timestamp: 1400743370135,
                   is_deleted: true,
                   type: 'user_follow',
                   id: '473123' } }
              */
        self.consumer.dispatch(null, msg)
      }
      //});
    })

    stream.on('stream_marker', function(msg) {
      self.consumer.dispatch(msg.meta.user_id, msg)
    })

    stream.on('channel_subscription', function(msg) {
      self.consumer.dispatch(msg.data.user.id, msg)
    })

    stream.on('error', function(error) {
      console.error('Stream error, reconnecting:', error)
      setTimeout(function() {
        stream.process(true)
      }, 2000)
    })

    stream.on('end', function() {
      console.error('Stream ended, reconnecting.')
      setTimeout(function() {
        stream.process(true)
      }, 2000)
    })

    stream.process(true)
  }

  self.get_or_create_stream(token, function(endpoint) {
    listen_to_endpoint(token, endpoint)
  })
}

module.exports.create_router = function(app, consumer) {
  return new StreamRouter(app, consumer)
}
