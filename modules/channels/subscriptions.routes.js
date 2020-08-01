module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // get current user's subscribed channels (token: user)
    // token: user, scope: public_messages or messages
    app.get(prefix + '/users/me/channels', function(req, resp) {
      //console.log('subscriptions.routes.js::GETusersMEchannels - token:', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('subscriptions.routes.js::GETusersMEchannels - err', err)
        //console.log('subscriptions.routes.js:GETusersMEchannels - got token:', usertoken)
        if (usertoken === null) {
          console.log('subscriptions.routes.js:GETchannels - failed to get token:', req.token, typeof (req.token))
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('subscriptions.routes.js:GETusersMEchannels - found a token', usertoken)
        req.apiParams.tokenobj = usertoken
        //console.log('subscriptions.routes.js:GETusersMEchannels - getting list of user subs for', usertoken.userid)
        dispatcher.getUserChannels(req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // subscribe to a channel (token: user / scope: public_messages or messages)
    app.post(prefix + '/channels/:channel_id/subscribe', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('subscriptions.routes.js::POSTchannelsXsubscribe - err', err)
        //console.log('subscriptions.routes.js:POSTchannelsXsubscribe - got token:', usertoken)
        if (usertoken == null) {
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        req.apiParams.tokenobj = usertoken
        //console.log('subscriptions.routes.js:POSTchannelsXsubscribe - user:', usertoken.userid, 'channel:', req.params.channel_id)
        //addChannelSubscription: function(token, channel_id, params, callback)
        dispatcher.addChannelSubscription(usertoken, req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })

    // unsubscribe to a channel (token: user / scope: public_messages or messages)
    app.delete(prefix + '/channels/:channel_id/subscribe', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('subscriptions.routes.js::DELETEchannelsXsubscribe - err', err)
        //console.log('subscriptions.routes.js:DELETEchannelsXsubscribe - got token:', usertoken)
        if (usertoken == null) {
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        req.apiParams.tokenobj = usertoken
        //console.log('subscriptions.routes.js:DELETEchannelsXsubscribe - user:', usertoken.userid, 'channel:', req.params.channel_id)
        //delChannelSubscription: function(token, channel_id, params, callback)
        dispatcher.delChannelSubscription(usertoken, req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })

    // Retrieve users subscribed to a Channel (Token: Any, Scope: public_messages or messages)
    app.get(prefix + '/channels/:channel_id/subscribers', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('subscriptions.routes.js::GETchannelsXsubscribers - err', err)
        if (usertoken == null) {
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        req.apiParams.tokenobj = usertoken
        //console.log('subscriptions.routes.js:GETchannelsXsubscribers - valid token')
        dispatcher.getChannelSubscriptions(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })

    app.get(prefix + '/channels/:channel_id/subscribers/ids', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('subscriptions.routes.js::GETchannelsXsubscribersIDS - err', err)
        if (usertoken == null) {
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        req.apiParams.tokenobj = usertoken
        //console.log('subscriptions.routes.js:GETchannelsXsubscribersIDS - valid token')
        dispatcher.getChannelsSubscriptionIds([req.params.channel_id], req.apiParams, usertoken, function(err, subs, meta) {
          if (err) console.error('subscriptions.routes - err', err)
          callbacks.dataCallback(resp)(err, subs[req.params.channel_id], meta)
        })
      })
    })

    app.get(prefix + '/channels/subscribers/ids', function(req, resp) {
      //console.log('subscriptions.routes.js:GETchannelsXsubscribers - ', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('subscriptions.routes.js::GETchannelsSUBSCRIBERSids - err', err)
        //console.log('subscriptions.routes.js:GETchannelsXsubscribers - ', usertoken)
        if (usertoken == null) {
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        const ids = req.query.ids.split(',') // make an array incase it's not
        //console.log('subscriptions.routes.js:GETchannelsXsubscribers - valid token')
        dispatcher.getChannelsSubscriptionIds(ids, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })
  }
}
