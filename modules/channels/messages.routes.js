module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks
    app.get(prefix + '/channels/messages', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('messages.routes.js:GETchannelsMESSAGES - getUserClientByToken err', err)
        //console.log('messages.routes.js:GETchannelsMESSAGES - got token:', usertoken)
        if (usertoken != null) {
          //console.log('messages.routes.js:GETchannelsMESSAGES - found a token', usertoken)
          req.apiParams.tokenobj = usertoken
        }
        //console.log('messages.routes.js:GETchannelsMESSAGES - ids', req.query.ids)
        dispatcher.getMessage(req.query.ids.split(/,/), req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // Retrieve multiple Messages (Token: User, Scope: public_messages or messages)
    // how do you receive public messages in a public channel?
    app.get(prefix + '/channels/:channel_id/messages', function(req, resp) {
      if (!req.token) {
        dispatcher.getChannelMessages(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
        return
      }
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('messages.routes.js:GETchannelsXmessages - getUserClientByToken err', err)
        if (usertoken) {
          req.apiParams.tokenobj = usertoken
        }
        dispatcher.getChannelMessages(req.params.channel_id, req.apiParams, callbacks.dataCallback(resp))
      })
    })
    // create message (token: user)
    app.post(prefix + '/channels/:channel_id/messages', function(req, resp) {
      //console.log('messages.routes.js:POSTchannelsXmessages - token', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('messages.routes.js:POSTchannelsXmessages - getUserClientByToken err', err)
        //console.log('messages.routes.js:POSTchannelsXmessages - got token:', usertoken, 'for', req.token)
        if (usertoken === null) {
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Valid token required to create message.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('messages.routes.js:GETchannels - found a token', usertoken)
        req.apiParams.tokenobj = usertoken
        req.apiParams.client_id = usertoken.client_id // is this needed?
        // FIXME: machine_only makes text not required
        if (!req.body.text) {
          console.warn('messages.routes.js:POSTchannelsXmessages - body empty', req.body)
          const res = {
            meta: {
              code: 500,
              error_message: 'Call requires text to be defined in JSON body'
            }
          }
          resp.status(500).type('application/json').send(JSON.stringify(res))
          return
        }
        const postdata = {
          text: req.body.text
        }
        if (req.body.reply_to) { // this is optional
          postdata.reply_to = req.body.reply_to
          console.log('setting reply_to', postdata.reply_to)
        }
        if (req.body.entities) {
          // parse_link: 1, parse_markdown_links: 1
          postdata.entities = req.body.entities
        }
        if (req.body.annotations) {
          //console.log('messages.routes.js:POSTchannelsXmessages - detected annotations', req.body.annotations)
          postdata.annotations = req.body.annotations
        }
        if (req.body.destinations) {
          postdata.destinations = req.body.destinations
          // we have to make sure we're here...
          postdata.destinations.push(usertoken.userid)
          // FIXME: also need to dedup this
        }
        //console.log('messages.routes.js:POSTchannelsXmessages - creating message in channel', req.params.channel_id)
        //addMessage: function(channel_id, postdata, params, token, callback) {
        dispatcher.addMessage(req.params.channel_id, postdata, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // delete message in channel
    app.delete(prefix + '/channels/:channel_id/messages/:message_id', function(req, resp) {
      //console.log('messages.routes.js:DELETEmessages - channel', req.params.channel_id, 'message', req.params.message_id)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('messages.routes.js:DELETEmessages - getUserClientByToken err', err)
        //console.log('messages.routes.js:DELETEmessages - got token:', usertoken)
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
        //console.log('messages.routes.js:DELETEmessages - found a token', usertoken)
        req.apiParams.tokenobj = usertoken
        //console.log('messages.routes.js:DELETEmessages - channel_id', req.params.channel_id)
        dispatcher.deleteMessage(req.params.message_id, req.params.channel_id, req.apiParams, usertoken, callbacks.dataCallback(resp))
      })
    })

    // Retrieve the Messages in a Channel
    app.get(prefix + '/channels/:channel_id/messages/:message_id', function(req, resp) {
      dispatcher.getChannelMessage(req.params.channel_id, req.params.message_id, req.apiParams, function(err, messages, meta) {
        if (err) console.error('messages.router.js::getCHANNELSxMESSAGESy - getUserClientByToken err', err)
        // ensure we only return one message
        const cb = callbacks.dataCallback(resp)
        cb(err, messages[0], meta)
      })
    })
  }
}
