let userStreamModel, userStreamSubscriptionModel

function start(options) {
  const schemaData = options.schemaData
  userStreamModel = schemaData.define('user_streams', {
    userid: { type: Number, index: true }, // couldn't we get this through the token?
    tokenid: { type: Number, index: true },
    connection_id: { type: String, index: true },
    auto_delete: { type: Boolean, index: true },
    connection_closed_at: { type: Date }
  })
  userStreamSubscriptionModel = schemaData.define('user_streamsubscriptions', {
    user_stream_id: { type: Number, index: true },
    stream: { type: String }, // endpoint
    params: { type: schemaData.Text } // params
  })
}

module.exports = {
  next: null,
  start: start,
  /** user stream */
  findOrCreateUserStream: function(connectionId, tokenId, userId, autoDelete, callback) {
    //console.log('dataaccess.camintejs::findOrCreateUserStream - start', connectionId, tokenId);
    //console.log('connectionId', connectionId)
    //console.log('tokenId', tokenId)
    //console.log('userId', userId)
    //console.log('autoDelete', autoDelete)
    // I don't think this is working
    userStreamModel.find({ where: { connection_id: connectionId, tokenid: tokenId } }, function(err, streams) {
      if (err) {
        console.log('dataaccess.camintejs::findOrCreateUserStream - err', err)
      }
      if (!streams.length) {
        // create one
        const stream = { connection_id: connectionId, tokenid: tokenId, auto_delete: autoDelete, userid: userId }
        userStreamModel.create(stream, function(err, createdStream) {
          //console.log('dataaccess.camintejs::findOrCreateUserStream - created', createdStream);
          callback(createdStream, err)
        })
      } else {
        if (streams.length === 1) {
          // update it
          const stream = streams[0]
          // actually just a cache for tokenId I think
          if (stream.userid === parseInt(userId)) {
            // we don't need to update, only set those things on creation
            //stream.update({ id: stream.id }, {}, function(err, finalStream) {
            //console.log('dataaccess.camintejs::findOrCreateUserStream - found', stream);
            callback(stream, err)
            //})
          } else {
            console.error('dataaccess.camintejs::findOrCreateUserStream - userid', userId, 'tried to change', stream.userid, 'stream', connectionId)
            callback(new Error('not your stream'), [])
          }
        } else {
          console.error('dataaccess.camintejs::findOrCreateUserStream - too many, connectionId:', connectionId, 'tokenId', tokenId)
          callback(new Error('too many'), [])
        }
      }
    })
    /*
    userStreamModel.findOrCreate({
      connection_id: connectionId,
      tokenid: tokenId,
    }, {
      auto_delete: autoDelete,
      userid: userId
    }, function(err, userStream) {
      // if found, need to update auto_delete
      callback(userStream, err);
    });
    */
  },
  findOrCreateUserSubscription: function(connectionNumId, stream, params, callback) {
    console.log('dataaccess.camintejs::findOrCreateUserSubscription', connectionNumId, stream)
    if (connectionNumId === undefined) {
      console.log('dataaccess.camintejs::findOrCreateUserSubscription - connectionNumId is empty', connectionNumId, stream)
      callback(new Error('empty connectionNumId'), {})
      return
    }
    // we can't scan for stream, it thinks it's a regex
    userStreamSubscriptionModel.find({ where: { user_stream_id: connectionNumId, stream: { like: stream } } }, function(err, subscriptions) {
      // subscription
      if (err) {
        console.log('dataaccess.camintejs::findOrCreateUserSubscription - err', err)
      }
      if (subscriptions.length) {
        if (subscriptions.length === 1) {
          // found
          callback(subscriptions[0], err)
        } else {
          // too many
          console.error('dataaccess.camintejs::findOrCreateUserSubscription - too many', subscriptions)
          callback(new Error('too many'), {})
        }
      } else {
        userStreamSubscriptionModel.create({ user_stream_id: connectionNumId, stream: stream, params: params }, function(createErr, createdSub) {
          //console.log('dataaccess.camintejs::findOrCreateUserSubscription - created', createdSub);
          callback(createdSub, createErr)
        })
      }
    })
    // I'm not getting returns...
    // stream isn't matchin
    /*
    userStreamSubscriptionModel.findOrCreate({
      user_stream_id: connectionNumId,
      stream: stream,
    }, {
      params: params
    }, function(err, subscription) {
      if (err) {
        console.log('dataaccess.camintejs::findOrCreateUserSubscription - err', err);
      }
      console.log('dataaccess.camintejs::findOrCreateUserSubscription - findOrCreate', subscription)
      // if found, need to update params
      callback(subscription, err);
    });
    */
  },
  userStreamUpdate: function(connectionId, update, callback) {
    userStreamModel.update({ where: { connection_id: connectionId } }, update, function(err, result) {
      callback(result, err)
    })
  },
  deleteUserStream: function(connectionNumId, callback) {
    //console.log('deleteUserStream', connectionNumId);
    userStreamModel.destroyById(connectionNumId, function(err) {
      if (callback) callback(connectionNumId, err)
    })
  },
  getUserStream: function(connectionNumId, callback) {
    userStreamModel.findById(connectionNumId, function(err, userStream) {
      callback(userStream, err)
    })
  },
  getAllUserStreams: function(callback) {
    //console.log('dataaccess.caminte.js::getAllUserStreams - start');
    const ref = this
    userStreamModel.all(function(err, userStreams) {
      //console.log('dataaccess.caminte.js::getAllUserStreams - result', userStreams.length);
      const ids = []
      const tokens = []
      for (const i in userStreams) {
        const userStream = userStreams[i]
        ids.push(userStream.id)
        tokens.push(userStream.tokenid)
      }
      //console.log('dataaccess.caminte.js::getAllUserStreams - tokens', tokens.length, 'ids', ids.length)
      const done = {
        subs: false,
        tokens: false
      }
      function doneCheck(type, data) {
        //console.log('dataaccess.caminte.js::getAllUserStreams:doneCheck - ', type, data.length)
        done[type] = data
        let complete = true
        for (const i in done) {
          if (done[i] === false) {
            complete = false
            break
          }
        }
        if (complete) {
          callback(err, {
            userStreams: userStreams,
            subs: done.subs,
            tokens: done.tokens
          })
        }
      }
      // look up subs
      userStreamSubscriptionModel.find({ where: { user_stream_id: { in: ids } } }, function(subErr, subs) {
        doneCheck('subs', subs)
      })
      // look up tokens
      ref.getApiTokens(tokens, function(err, usertokens) {
        if (err) console.error('userstreams.model.js::getAllUserStreams - getApiTokens err', err)
        doneCheck('tokens', usertokens)
      })
    })
  }
}
