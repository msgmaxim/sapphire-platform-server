// copyentities
const entitiesController = require('../users/entities.controller')

module.exports = {
  //
  // messages
  //
  apiToMessage: function(api, meta, callback) {
    const channel = api
    callback(null, channel)
  },
  messageToAPI: function(message, params, tokenObj, callback, meta) {
    if (!message) {
      console.trace('messages.controller::messageToAPI - empty message', message)
      callback(new Error('empty message'), {})
      return
    }
    const api = {
      channel_id: message.channel_id,
      created_at: message.created_at,
      entities: {
        links: [],
        mentions: [],
        hashtags: []
      },
      id: message.id,
      machine_only: !!message.machine_only,
      num_replies: 0,
      source: {},
      thread_id: message.id,
      reply_to: null
    }
    // this (is_deleted) key may be omitted instead of being false
    if (message.is_deleted) {
      api.is_deleted = true
      delete api.text
      delete api.html
    } else {
      api.text = message.text
      api.html = message.html
      api.source = {}
    }
    if (message.reply_to) {
      api.reply_to = message.reply_to
    }
    const ref = this

    const messageDone = {
      user: false,
      annotations: false,
      entities: false
    }

    function setDone(type) {
      messageDone[type] = true
      // if something is not done
      //console.log('messages.controller.js::messageToAPI('+message.id+') - checking if done')
      for (const i in messageDone) {
        if (!messageDone[i]) {
          //console.log('messages.controller.js::messageToAPI('+message.id+') -', i, 'is not done')
          return
        }
      }
      //console.log('messages.controller.js::channelToAPI('+channel.id+') - done', data, meta)
      //console.log('messages.controller.js::messageToAPI('+message.id+') - done, text', api.id, message.text)
      // everything is done
      callback(null, api, meta)
    }
    function loadUser(userid, params, cb) {
      //console.log('messages.controller.js::postToAPI('+message.id+') - getting user '+message.userid)
      ref.getUser(userid, params, function(userErr, user, userMeta) {
        if (userErr) console.error('messages.controller.js::messageToAPI - getUser err', userErr)
        //console.log('messages.controller.js::postToAPI('+message.id+') - got user '+message.userid, userErr)
        if (!user) {
          user = {
            id: 0,
            username: 'likelydeleted',
            created_at: '2014-10-24T17:04:48Z',
            avatar_image: {
              url: ''
            },
            cover_image: {
              url: ''
            },
            counts: {
              following: 0
            }
          }
        }
        cb(userErr, user, userMeta)
      }) // getUser
    }
    function loadAnnotation(mid, cb) {
      ref.getAnnotation('message', mid, function(err, dbNotes, noteMeta) {
        const apiNotes = []
        for (const j in dbNotes) {
          const note = dbNotes[j]
          //console.log('got note', j, '#', note.type, '/', note.value, 'for', posts[i].id)
          apiNotes.push({
            type: note.type,
            value: note.value
          })
        }
        cb(err, apiNotes, noteMeta)
      })
    }

    function loadEntites(message, cb) {
      // use entity cache (DB read or CPU calculate)
      if (1) {
        //console.log('messages.controller.js::postToAPI('+post.id+') - getEntity post. post.userid:', post.userid)
        if (!message.id) {
          console.log('messages.controller.js::messageToAPI:::loadEntites', message)
          console.trace('messages.controller.js::messageToAPI:::loadEntites')
          cb()
          return
        }
        ref.getEntities('message', message.id, function(entitiesErr, entities, entitiesMeta) {
          //console.log('messages.controller.js::postToAPI('+post.id+') - gotEntities')
          api.entities = {
            mentions: [],
            hashtags: [],
            links: []
          }
          entitiesController.copyentities('mentions', entities.mentions, api, 1)
          entitiesController.copyentities('hashtags', entities.hashtags, api, 1)
          entitiesController.copyentities('links', entities.links, api, 1)
          // use html cache?
          if (1) {
            //console.log('messages.controller.js::postToAPI('+post.id+') - calling final comp')
            //finalcompsite(post, user, client, callback, err, meta)
            cb()
          } else {
            // generate HTML
            // text, entities, postcontext, callback
            ref.textProcess(message.text, message.entities, true, function(err, textProcess) {
              if (err) console.error('messages.controllers.js::messageToAPI - textProcess err', err)
              //console.dir(textProcess)
              api.html = textProcess.html
              //finalcompsite(post, user, client, callback, err, meta)
              cb()
            })
          }
        }) // getEntities
      } else {
        ref.textProcess(message.text, message.entities, true, function(err, textProcess) {
          if (err) console.error('messages.controllers.js::messageToAPI - textProcess err', err)
          api.entities = textProcess.entities
          api.html = textProcess.html
          //finalcompsite(post, user, client, callback, err, meta)
          cb()
        })
      }
    }

    if (message.is_deleted) {
      setDone('entities')
    } else {
      loadEntites(message, function() {
        setDone('entities')
      })
    }

    loadUser(message.userid, params, function(userErr, user, userMeta) {
      if (userErr) console.error('messages.controller.js::messageToAPI - loadUser err', userErr)
      api.user = user
      //console.log('messages.controller.js::messageToAPI - params', params.generalParams)
      if (params.generalParams.annotations || params.generalParams.post_annotations) {
        // do user annotations need to be loaded?
        //console.log('write me')
      }
      setDone('user')
      //callback(api, null)
    })

    if (!message.is_deleted && (params.generalParams.annotations || params.generalParams.post_annotations)) {
      loadAnnotation(message.id, function(noteErr, apiNotes, noteMeta) {
        if (noteErr) console.error('messages.controller.js::messageToAPI - loadAnnotation err', noteErr)
        //console.log('messages.controller.js::messageToAPI - loading annotations', apiNotes.length)
        api.annotations = apiNotes
        setDone('annotations')
      })
    } else {
      //api.annotations=[]
      setDone('annotations')
    }
  },
  /**
   * add/update message
   * @param {object} json - message object data
   * @param {number} ts - the timestamp of this event
   * @param {metaCallback} callback - function to call after completion
   */
  setMessage: function(json, ts, callback) {
    //console.log('messages.controller.js::setMessage - write me!')
    // update user object
    // if the app gets behind (and/or we have mutliple stream)
    // the message could be delayed, so it's better to tie the user timestamp
    // for when the message was created then now
    // if though the user object maybe be up to date when the packet was sent
    // however the delay in receiving and processing maybe the cause of delay
    // meta.timestamp maybe the most accurate here?
    this.updateUser(json.user, ts)
    // create message DB object (API=>DB)
    const message = {
      id: json.id,
      channelid: json.channel_id,
      text: json.text,
      html: json.html,
      machine_only: json.machine_only,
      client_id: json.client_id,
      thread_id: json.thread_id,
      userid: json.user.id,
      reply_to: json.reply_to,
      is_deleted: json.is_deleted,
      created_at: json.created_at
    }
    this.cache.setMessage(message, function(err, msg) {
      // if current, extract annotations too
      if (callback) {
        callback(err, msg)
      }
    })
    if (this.notsilent) {
      process.stdout.write('M')
    }
  },
  addMessage: function(channel_id, postdata, params, tokenobj, callback) {
    //console.log('message.controller.js::addMessage - channel_id', channel_id)
    if (!channel_id) {
      console.error('message.controller.js::addMessage - channel_id is falsish')
      callback('message.controller.js::addMessage - channel_id is falsish')
      return
    }
    const ref = this
    // change channel permissions
    function continueAddMessage(channel_id) {
      //console.log('message.controller.js::addMessage - checking channel', channel_id, 'permission for token user', tokenobj?tokenobj.userid:0)
      ref.cache.getChannel(channel_id, params, function(channelErr, channel, channelMeta) {
        if (channelErr) console.error('messages.controller::addMessage - channelErr', channelErr)
        if (!channel) {
          console.warn('messages.controller::addMessage - no channel for', channel_id)
        }
        if (!ref.checkWriteChannelAccess(channel, tokenobj ? tokenobj.userid : 0)) {
          //console.log('message.controller.js::addMessage - denying access')
          callback(new Error('access denied to channel'), {}, {
            code: tokenobj ? 403 : 401
          })
          return
        }
        continueAddMessage2(channel_id)
      })
    }

    /*
    function getMessageThreadID(reply_to, cb) {
      ref.cache.getMessage(reply_to, function(err, message) {
        if (err) {
          console.error('message getThreadID', err)
          return cb()
        }
        cb(message.thread_id)
      })
    }
    */

    // actually create message record
    function continueAddMessage2(channel_id) {
      //console.log('messages.controller.js::addMessage - continueAddMessage2', channel_id)
      // why does annotations force channel_id 0?
      // so the message doesn't show up until
      // the annotations are written all the way through
      // it prevents bounces in the bridges
      const message = {
        channel_id: postdata.annotations ? 0 : parseInt(channel_id),
        annotation_channel_id: channel_id,
        text: postdata.text,
        html: postdata.text, // FIXME: generate HTML from text
        machine_only: postdata.machine_only ? 1 : 0,
        client_id: tokenobj.client_id,
        //thread_id: json.thread_id,
        userid: tokenobj.userid,
        //reply_to: json.reply_to,
        is_deleted: false,
        created_at: new Date()
      }
      if (postdata.reply_to) {
        // ok if it's a reply, set it
        message.reply_to = postdata.reply_to
      }

      function getEntities(message, cb) {
        ref.textProcess(message.text, message.entities, true, function(err, textProc) {
          if (err) console.error('messages.controllers.js::addMessage - textProcess err', err)
          //console.log('messages.controller.js::addMessage - textProc', textProc)
          message.entities = textProc.entities
          message.html = textProc.html
          cb()
        })
      }
      // check out postToAPI
      // needs to run before textProcess
      function checkTagUser(message, cb) {
        if (!((message.text && message.text.match(/{username}/)) || (message.html && message.html.match(/{username}/)))) {
          cb()
          return
        }
        ref.cache.getUser(message.userid, function(err, user, meta) {
          if (err) console.error('messages.controllers.js::addMessage - getUser err', err)
          if (message.text && message.text.match(/{username}/)) {
            message.text = message.text.replace(new RegExp('{username}', 'g'), user.username)
          }
          if (message.html && message.html.match(/{username}/)) {
            message.html = message.html.replace(new RegExp('{username}', 'g'), user.username)
          }
          cb()
        })
      }
      // these both mess with .html / .text
      checkTagUser(message, function() {
        // after username is in place, we'll have better positions
        getEntities(message, function() {
          //console.log('messages.controller.js::addMessage - message', message)
          ref.cache.addMessage(message, function(err, msg, meta) {
            // msg just has id...
            if (err) {
              console.log('messages.controller.js::addMessage - err', err)
              callback(err, [], {
                code: 500
              })
              return
            }
            if (postdata.annotations) {
              //console.log('messages.controller.js::addMessage - detected annotations', channel_id, postdata.annotations)
              // fix up channel_id for msg pump
              message.channel_id = channel_id
              ref.setAnnotations('message', msg.id, postdata.annotations, function() {
                console.log('write channel_id', channel_id)
                ref.cache.setMessage({
                  id: msg.id,
                  channel_id: parseInt(channel_id)
                }, function(err, omsg) {
                  if (err) console.error('messages.controllers.js::addMessage - setAnnotations err', err)
                  // omsg will be 1 if it's an update
                  //console.log('channel set', channel_id, 'for', msg.id, omsg)
                })
              })
            }
            // OPT: if no streams and no callback, no need for API conversion
            message.id = msg.id
            //console.log('messages.controller.js::addMessage - msg', message)
            ref.messageToAPI(message, params, tokenobj, function(err, api) {
              if (err) console.error('message.controller.js::addMessage - messageToAPI err', err)
              //console.log('messages.controller.js::addMessage - api', api)
              ref.pumpStreams({
                id: msg.id,
                type: 'message',
                op: 'add',
                actor: msg.userid,
                channel_id: channel_id
              }, api)
              ref.setEntities('message', msg.id, message.entities, function() {
                // if current, extract annotations too
                if (callback) {
                  //console.log('messages.controller.js::addMessage - has callback', api)
                  callback(err, api, meta)
                }
              })
            }, meta)
          })
        })
      })
    }
    if (channel_id === 'pm') {
      //console.log('messages.controller.js::addMessage - pm channel')
      if (!postdata.destinations) {
        console.log('messages.controller.js::addMessage - no destinations passed', postdata)
        callback(new Error('no destinations passed'), {})
        return
      }
      this.cache.getPMChannel(postdata.destinations, function(err, nChannel_id) {
        if (err) console.error('messages.controller.js::addMessage - getPMChannel err', err)
        //console.log('messages.controller.js::addMessage - pm channel is', nChannel_id, err)
        continueAddMessage(nChannel_id)
      })
    } else {
      //console.log('messages.controller.js::addMessage - not pm channel', channel_id)
      continueAddMessage(channel_id)
    }
  },
  deleteMessage: function(message_id, channel_id, params, tokenObj, callback) {
    //console.log('messages.controller.js::deleteMessage - channel_id', channel_id)
    if (!message_id) {
      console.log('messages.controller.js::deleteMessage - no message')
      callback(new Error('no message passed in'), [], {
        code: 410
      })
      return
    }
    if (!channel_id) {
      console.log('messages.controller.js::deleteMessage - no channel')
      callback(new Error('no channel passed in'), [], {
        code: tokenObj ? 403 : 401
      })
      return
    }
    if (!tokenObj || !tokenObj.userid) {
      console.log('messages.controller.js::deleteMessage - no token')
      callback(new Error('no token passed in'), [], {
        code: 401
      })
      return
    }
    const ref = this
    //console.log('messages.controller.js::deleteMessage - checking channel', channel_id, 'permission for token user', tokenobj?tokenobj.userid:0)
    ref.cache.getChannel(channel_id, params, function(channelErr, channel, channelMeta) {
      if (!ref.checkWriteChannelAccess(channel, tokenObj ? tokenObj.userid : 0)) {
        console.log('messages.controller.js::deleteMessage - denying channel access')
        callback(new Error('access denied to channel'), {}, {
          code: 403
        })
        return
      }
      // is this your message
      ref.getMessage(message_id, params, tokenObj, function(apiErr, apiMsgs, apiMeta) {
        if (apiErr) {
          console.error('messages.controller.js::deleteMessage - err', apiErr)
        }
        if (!apiMsgs || !apiMsgs.length || apiMsgs.length !== 1) {
          console.log('messages.controller.js::deleteMessage -', message_id, 'not found')
          callback(new Error('message not found'), {}, {
            code: 410
          })
          return
        }
        const apiMsg = apiMsgs[0]
        if (!apiMsg) {
          console.log('messages.controller.js::deleteMessage -', message_id, 'not found')
          callback(new Error('message not found'), {}, {
            code: 410
          })
          return
        }
        if (!apiMsg.user) {
          console.log('messages.controller.js::deleteMessage - ', message_id, ' has no user', apiMsg)
          callback(new Error('message not found'), {}, {
            code: 410
          })
          return
        }
        if (apiMsg.user.id !== tokenObj.userid) {
          console.log('messages.controller.js::deleteMessage - denying message access')
          callback(new Error('access denied to message'), {}, {
            code: 403
          })
          return
        }
        ref.cache.deleteMessage(message_id, channel_id, function(err, msg, meta) {
          if (err) console.error('messages.controllers.js::deleteMessage - err', err)
          //console.log('messages.controller.js::deleteMessage - api1', msg)
          apiMsg.is_deleted = true
          callback(apiErr, apiMsg, apiMeta)
          /*
          ref.cache.getMessage(message_id, function(message, err, meta) {
            ref.messageToAPI(message, params, tokenObj, function(api, err) {
              //console.log('messages.controller.js::deleteMessage - api2', api)
              callback(api, err)
            }, meta)
          })
          */
        })
      })
    })
  },
  getMessage: function(mids, params, tokenObj, callback) {
    //console.log('messages.controller.js::getMessage - mids', mids)
    const ref = this
    //console.log('messages.controller.js::getMessage - cache', this.cache.name)
    //console.log('messages.controller.js::getMessage - cache.next', this.cache.next.name)
    this.cache.getMessage(mids, params, function(err, messages, meta) {
      if (err) console.error('messages.controller.js::getMessage - err', err)
      // make messages an array if not
      if (!(messages instanceof Array)) {
        messages = [messages]
      }
      //console.log('messages.controller.js::getMessage - messages', messages.length)
      if (!messages.length) {
        console.warn('messages.controller.js::getMessage - no messages', mids)
        return callback(err, [], meta)
      }
      const apis = []
      for (const i in messages) {
        const message = messages[i]
        // messageToAPI: function(message, params, tokenObj, callback, meta) {
        ref.messageToAPI(message, params, tokenObj, function(err, api) {
          if (err) console.error('messages.controller.js::getMessage - messageToAPI err', err)
          apis.push(api)
          //console.log(apis.length, '/', messages.length)
          if (apis.length === messages.length) {
            callback(err, apis, meta)
          }
        }, meta)
      }
    })
  },
  /**
   * get messages for specified channel id
   * @param {number} cid - the id of channel you're requesting
   * @param {object} param - message formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannelMessages: function(cid, params, callback) {
    //console.log('messages.controller.js::getChannelMessages - getChannelMessages', cid, params)
    const ref = this
    if (cid === 'pm') {
      console.log('messages.controller.js::getChannelMessages - getting pm message is not allowed')
      callback(new Error('getting pm message is not allowed'), [])
      return
    }
    //getChannel: function(ids, params, callback) {
    this.cache.getChannel(cid, params, function(channelErr, channel, channelMeta) {
      if (channelErr) console.error('messages.controller.js::getChannelMessages - getChannel err', channelErr)
      //console.log('messages.controller.js:getChannelMessages - check', channel)
      if (!channel) {
        console.warn('messages.controller.js::getChannelMessages - no such channel', cid)
        callback(null, [], {
          code: 404,
          error: 'no such channel'
        })
        return
      }
      if (!ref.checkChannelAccess(channel, params.tokenobj ? params.tokenobj.userid : 0)) {
        callback(new Error('access denied to channel'), [], {
          code: params.tokenobj ? 403 : 401
        })
        return
      }

      // I wonder if this should be migrated into caminte
      // well it needs to be unified per class
      // but where it lives is tbh
      //
      // disabled, since we had these properly now in caminte
      // not sure why we were rewriting them...
      // the params are more for messages than channel?
      /*
      var nParams=params.pageParams
      //console.log('messages.controller.js::getChannelMessages - nParams', nParams)
      nParams.generalParams=params.generalParams
      if (nParams.count===undefined) nParams.count=20
      if (nParams.before_id===undefined) nParams.before_id=-1 // -1 being the very end
      */

      ref.cache.getChannelMessages(cid, params, function(err, messages, meta) {
        if (channelErr) console.error('messages.controller.js::getChannelMessages - err', err)
        //console.log('messages.controller.js::getChannelMessages -', cid, 'has', messages.length)
        if (!messages.length) {
          callback(err, [])
          return
        }
        function finishMessages() {
          // FIXME: doesn't perserve order does it? nope
          const apis = {}
          let apiCount = 0
          for (const i in messages) {
            // channel, params, tokenObj, callback, meta
            ref.messageToAPI(messages[i], params, params.tokenobj, function(cErr, message) {
              if (cErr) console.error('messages.controller.js::getChannelMessages - messageToAPI err', cErr)
              //console.log('messages.controller.js::getChannelMessages - pushing', message.id)
              //apis.push(message)
              apis[message.id] = message
              apiCount++
              //console.log('messages.controller.js::getChannelMessages - finishMessages', apiCount, '/', messages.length)
              if (messages.length === apiCount) {
                const list = []
                for (const i in messages) {
                  list.push(apis[messages[i].id])
                }
                callback(err || cErr, list)
              }
            })
          }
        }
        if (params.tokenobj && params.tokenobj.userid) {
          ref.cache.getStreamMarker(params.tokenobj.userid, 'channel:' + cid, function(mErr, marker) {
            meta = {
              code: 200,
              marker: {
                name: 'channel:' + cid
              }
            }
            if (marker !== undefined) {
              //console.log('messages.controller.js::getChannelMessages - got marker', marker)
              meta.marker = marker
            }
            finishMessages()
          })
        } else {
          finishMessages()
        }
      })
    })
  },
  /**
   * get messages for specified message ids on specified channel
   * @param {number} cid - the id of channel you're requesting
   * @param {array} mids - the ids of messaes you're requesting
   * @param {object} param - message formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannelMessage: function(cid, mids, params, callback) {
    //console.log('messages.controller.js::getChannelMessage - start', cid, mids)
    if (mids === 'undefined') {
      console.trace('messages.controller.js::getChannelMessage - message ids are string undefined', cid, mids)
      callback(new Error('undefined message ID'))
      return
    }
    const ref = this
    this.cache.getMessage(mids, params, function(err, messages, meta) {
      if (err) console.error('messages.controller.js::getChannelMessage - err', err)
      if (messages === undefined) {
        console.trace('messages.controller.js::getMessage - messages is undefined')
        messages = []
      }
      // make messages an array if not
      if (!(messages instanceof Array)) {
        messages = [messages]
      }
      //if (!messages.length) {
      //console.log('messages.controller.js::getMessage - messages', messages)
      //}
      const apis = []
      for (const i in messages) {
        const message = messages[i]
        //console.log('messages.controller.js::getMessage - message', JSON.stringify(message))
        if (message && message.channel_id !== parseInt(cid)) {
          apis.push(false)
          if (apis.length === messages.length) {
            callback(err, apis, meta)
          }
          continue
        }
        // messageToAPI: function(message, params, tokenObj, callback, meta) {
        ref.messageToAPI(message, params, params.tokenObj, function(err, api) {
          if (err) console.error('messages.controller.js::getChannelMessage - messageToAPI err', err)
          apis.push(api)
          //console.log(apis.length, '/', messages.length)
          if (apis.length === messages.length) {
            callback(err, apis, meta)
          }
        }, meta)
      }
    })
  }
}
