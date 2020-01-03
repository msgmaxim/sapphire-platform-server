var appStreamModel

function start(options) {
  const schemaData = options.schemaData
  appStreamModel = schemaData.define('app_streams', {
    client_id: { type: String, length: 32 }, // a client can have multiple appStreams
    filter: { type: schemaData.JSON, }, // JSON
    object_types: { type: String, }, // comma separated list of object types:
    // post, star, user_follow, mute, block, stream_marker, message, channel, channel_subscription, token, file, user
    //type: is always long_poll
    key: { type: String, }, // user label
  })
}

module.exports = {
  next: null,
  start: start,
}
