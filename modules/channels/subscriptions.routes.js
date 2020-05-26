module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // get current user's subscribed channels (token: user)
    // token: user, scope: public_messages or messages
    app.get(prefix+'/users/me/channels', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:GETusersMEchannels - token:', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:GETusersMEchannels - got token:', usertoken)
        if (usertoken===null) {
          console.log('dialect.appdotnet_official.js:GETchannels - failed to get token:', req.token, typeof(req.token))
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('dialect.appdotnet_official.js:GETusersMEchannels - found a token', usertoken)
        req.apiParams.tokenobj=usertoken
        //console.log('dialect.appdotnet_official.js:GETusersMEchannels - getting list of user subs for', usertoken.userid)
        dispatcher.getUserChannels(req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // subscribe to a channel (token: user / scope: public_messages or messages)
    app.post(prefix+'/channels/:channel_id/subscribe', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:POSTchannelsXsubscribe - got token:', usertoken)
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
        req.apiParams.tokenobj=usertoken
        //console.log('dialect.appdotnet_official.js:POSTchannelsXsubscribe - user:', usertoken.userid, 'channel:', req.params.channel_id)
        //addChannelSubscription: function(token, channel_id, params, callback)
        dispatcher.addChannelSubscription(usertoken, req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })

    // unsubscribe to a channel (token: user / scope: public_messages or messages)
    app.delete(prefix+'/channels/:channel_id/subscribe', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:DELETEchannelsXsubscribe - got token:', usertoken)
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
        req.apiParams.tokenobj=usertoken
        //console.log('dialect.appdotnet_official.js:DELETEchannelsXsubscribe - user:', usertoken.userid, 'channel:', req.params.channel_id)
        //delChannelSubscription: function(token, channel_id, params, callback)
        dispatcher.delChannelSubscription(usertoken, req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })


    // Retrieve users subscribed to a Channel (Token: Any, Scope: public_messages or messages)
    app.get(prefix+'/channels/:channel_id/subscribers', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
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
        req.apiParams.tokenobj=usertoken
        //console.log('dialect.appdotnet_official.js:GETchannelsXsubscribers - valid token')
        dispatcher.getChannelSubscriptions(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })

    app.get(prefix+'/channels/:channel_id/subscribers/ids', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
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
        req.apiParams.tokenobj=usertoken
        //console.log('dialect.appdotnet_official.js:GETchannelsXsubscribers - valid token')
        dispatcher.getChannelsSubscriptionIds([req.params.channel_id], req.apiParams, usertoken, function(subs, err, meta) {
          callbacks.dataCallback(resp)(subs[req.params.channel_id], err, meta)
        })
      })
    })

    app.get(prefix+'/channels/subscribers/ids', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:GETchannelsXsubscribers - ', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        var userid=''
        //console.log('dialect.appdotnet_official.js:GETchannelsXsubscribers - ', usertoken)
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
        var ids = req.query.ids.split(',') // make an array incase it's not
        //console.log('dialect.appdotnet_official.js:GETchannelsXsubscribers - valid token')
        dispatcher.getChannelsSubscriptionIds(ids, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

  }
}
