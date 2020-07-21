module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // has to be before /channels/:channel_id
    // search for channels (Token: User, Scope: public_messages or messages)
    app.get(prefix+'/channels/search', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:channelsSearch - start', req.token)
      // don't we already handle this in the middleware
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken',usertoken)
        if (usertoken==null) {
          //console.log('dialect.appdotnet_official.js:channelsSearch - no token')
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('dialect.appdotnet_official.js:channelsSearch - getUserStream', req.token)
        //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp))
        var critera = {
        }
        if (req.query.type) {
          critera.type = req.query.type
        }
        if (req.query.creator_id) {
          critera.ownerid = req.query.creator_id
        }
        dispatcher.channelSearch(critera, req.apiParams, usertoken, callbacks.dataCallback(resp, req.token))
      })
    })

    // channel_id 1383 was always good for testing
    // Retrieve a Channel && Retrieve multiple Channels
    app.get(prefix+'/channels/:channel_id', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:GETchannels - got token:', usertoken)
        var userid=''
        if (usertoken!=null) {
          //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken)
          req.apiParams.tokenobj=usertoken
          userid=usertoken.userid
        }
        //console.log('dialect.appdotnet_official.js:GETchannels - channel_id', req.params.channel_id)
        dispatcher.getChannel(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })

    // update channel (Token: User / Scope: public_messages or messages)
    // maybe a app.patch that calls this too?
    app.put(prefix+'/channels/:channel_id', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:PUTchannels - got token:', usertoken)
        var userid=''
        if (usertoken==null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('dialect.appdotnet_official.js:PUTchannels - found a token', usertoken)
        req.apiParams.tokenobj=usertoken
        //userid=usertoken.userid
        //console.log('dialect.appdotnet_official.js:PUTchannels - body', typeof(req.body), Object.keys(req.body))
        // The only keys that can be updated are annotations, readers, and writers
        var updates = {}
        if (req.body.writers) {
          updates.writers = req.body.writers
        }
        if (req.body.readers) {
          updates.readers = req.body.readers
        }
        if (req.body.annotations) {
          updates.annotations = req.body.annotations
        }
        /*
        { auto_subscribe: true,
          writers: { immutable: false, any_user: true },
          readers: { immutable: false, public: true },
          annotations:
           [ { type: 'net.patter-app.settings', value: [Object] },
             { type: 'net.app.core.fallback_url', value: [Object] } ] }
        */
        //console.log('dialect.appdotnet_official.js:PUTchannels - updates', updates, 'notes', updates.annotations)
        // updateChannel: function(channelid, update, params, token, callback) {
        dispatcher.updateChannel(req.params.channel_id, updates, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    app.delete(prefix+'/channels/:channel_id', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:DELETEchannels - got token:', usertoken)
        var userid=''
        if (usertoken==null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('dialect.appdotnet_official.js:DELETEchannels - found a token', usertoken)
        req.apiParams.tokenobj=usertoken
        // FIXME: enforce that req.params.channel_id is numeric
        //console.log('dialect.appdotnet_official.js:DELETEchannels - channel_id', req.params.channel_id)
        // deactiveChannel: function(channelid, params, token, callback) {
        dispatcher.deactiveChannel(req.params.channel_id, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // Create a channel (token: user)
    app.post(prefix+'/channels', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:POSTchannels - token', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:POSTchannels - usertoken', usertoken)
        if (usertoken===null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        req.apiParams.tokenobj=usertoken
        //console.log('dialect.appdotnet_official.js:POSTchannels - creating channel of type', req.body.type)
        if (!req.body.type) {
          var res={
            "meta": {
              "code": 400,
              "error_message": "Require a type (JSON encoded)"
            }
          }
          resp.status(400).type('application/json').send(JSON.stringify(res))
          return
        }
        // Currently, the only keys we use from your JSON will be readers, writers, annotations, and type.
        var channel={
          type: req.body.type,
          readers: req.body.readers?req.body.readers:{},
          writers: req.body.writers?req.body.writers:{},
          editors: {},
          annotations: req.body.annotations
        }
        dispatcher.addChannel(channel, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // also Retrieve multiple Channels (token: any)
    app.get(prefix+'/channels', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:GETchannels - token:', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:GETchannels - got token:', usertoken)
        var userid=''
        if (usertoken!=null) {
          //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken)
          req.apiParams.tokenobj=usertoken
          userid=usertoken.userid
        }
        var ids=null
        if (req.query.ids) {
          ids=req.query.ids.split(/,/)
          //console.log('dialect.appdotnet_official.js:GETchannels - getting list of channels', ids)
          dispatcher.getChannel(ids, req.apiParams, callbacks.dataCallback(resp))
          return
        }
        if (usertoken===null) {
          console.log('dialect.appdotnet_official.js:GETchannels - failed to get token:', req.token)
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        console.log('dialect.appdotnet_official.js:GETchannels - getting list of user subs for', userid)
        dispatcher.getUserSubscriptions(userid, req.apiParams, callbacks.dataCallback(resp))
      })
    })
  }
}
