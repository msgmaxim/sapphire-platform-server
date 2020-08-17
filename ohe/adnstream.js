// this consumes a stream (HTTP long poll)
var request = require('request')
var es = require('event-stream')
var EventEmitter = require('events').EventEmitter
var util = require('util')
var url = require('url')
var nconf = require('nconf')

var stream_url_override = nconf.get('adn:stream_url_override')

// Constructor
function ADNStream(endpoint) {
  EventEmitter.call(this) // call EventEmitter constructor

  this.headers = {}

  // Here is where some of our infrastructure details leak
  // into something we're open sourcing. Sorry about this, y'all.
  if (stream_url_override) {
    var parsed_endpoint = new URL(endpoint)
    var parsed_override = new URL(stream_url_override)
    this.headers.host = parsed_endpoint.hostname
    parsed_override.pathname = parsed_endpoint.pathname
    endpoint = url.format(parsed_override)
  }

  this.endpoint = endpoint
}
// Extend EventEmitter
util.inherits(ADNStream, EventEmitter)

// process method
ADNStream.prototype.process = function(purge) {
  var self = this
  var qs = {}

  if (purge) {
    qs.purge = 1
  }

  this.request = request({
    url: this.endpoint,
    method: 'GET',
    headers: this.headers,
    qs: qs
  })

  this.request.on('error', function(error) {
    this.emit('error', error)
  })

  this.request.on('response', function(response) {
    console.info('Got response:', response.statusCode)
    if (response.statusCode === 200) {
      console.info('Connected to stream')
    } else if (response.statusCode === 429) {
      console.info('Rate limited, that\'s bad...')
      var stop = new Date().getTime()
      // wait 30 sesc
      while (new Date().getTime() < stop + 30 * 1000) {
        // this block all incoming web requests
        ;
      }
      console.log('Trying again...')
    } else {
      console.error('Unexpected status code:', response.statusCode)
    }

    response.on('end', function() {
      self.emit('end')
    })
  })

  var processor = es.through(function(data) {
    var s = data.toString('utf-8')
    if (!s.length) { return }

    var obj
    try {
      obj = JSON.parse(s)
    } catch (err) {
      return
    }

    //console.log("Processing "+obj.meta.type);

    // dispatch event
    self.emit(obj.meta.type, obj)
  })

  // execute request and pipe each command separated by \r\n into processor
  this.request.pipe(es.pipeline(es.split('\r\n'), processor))
}

module.exports.ADNStream = ADNStream
