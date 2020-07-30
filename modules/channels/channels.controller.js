module.exports={
  /** channels */
  apiToChannel: function(api, meta, callback) {
    //console.log('channel.controller.js::apiToChannel - api', api)
    // map API to DB
    // default to most secure
    var raccess=2 // 0=public, 1=loggedin, 2=selective
    var waccess=2 // 1=loggedin, 2=selective
    // editors are always seletcive
    if (api.readers) {
      if (api.readers.any_user) {
        raccess=1
      }
      if (api.readers.public) {
        raccess=0
      }
    } else {
      api.readers={ user_ids: [] }
    }
    if (api.writers) {
      if (api.writers.any_user) {
        waccess=1
      }
    } else {
      api.writers={ user_ids: [] }
    }
    if (api.readers.user_ids == undefined) {
      api.readers.user_ids=[]
    }
    if (api.writers.user_ids == undefined) {
      api.writers.user_ids=[]
    }
    if (api.editors.user_ids == undefined) {
      api.editors.user_ids=[]
    }
    var channel={
      id: api.id,
      ownerid: api.owner.id,
      type: api.type,
      reader: raccess,
      writer: waccess,
      readers: api.readers.user_ids.join(','),
      writers: api.writers.user_ids.join(','),
      editors: api.editors.user_ids.join(','),
    }
    callback(false, channel, meta)
  },
  channelToAPI: function (channel, params, tokenObj, callback, meta) {
    if (typeof(channel)!='object') {
      console.trace('channel.controller.js::channelToAPI - channel passed in wasnt object')
      callback('bad data')
      return
    }
    if (!channel) {
      console.trace('channel.controller.js::channelToAPI - channel is falish')
      callback('null data')
      return
    }
    //console.log('channel', channel)
    var api={
      counts: {
        messages: 0,
        subscribers: 0,
      },
      has_unread: false,
      id: channel.id,
      //owner: {},
      is_inactive: !!channel.inactive,
      readers: {
        any_user: channel.reader==1?true:false,
        immutable: channel.readedit?false:true,
        public: channel.reader==0?true:false,
        user_ids: channel.readers==null?[]:channel.readers.split(/,/),
        you: false,
      },
      editors: {
        any_user: false,
        immutable: channel.editedit?false:true,
        public: false,
        user_ids: channel.editors==null?[]:channel.editors.split(/,/),
        you: false,
      },
      writers: {
        any_user: channel.writer==1?true:false,
        immutable: channel.writeedit?false:true,
        public: false,
        user_ids: channel.writers==null?[]:channel.writers.split(/,/),
        you: false,
      },
      type: channel.type,
    }
    var idx = api.readers.user_ids.indexOf("")
    if (idx != -1) {
      api.readers.user_ids.splice(idx, 1)
    }
    idx = api.editors.user_ids.indexOf("")
    if (idx != -1) {
      api.editors.user_ids.splice(idx, 1)
    }
    idx = api.writers.user_ids.indexOf("")
    if (idx != -1) {
      api.writers.user_ids.splice(idx, 1)
    }
    // make sure ownerid isn't in the writers
    // we need it in the db this way for PM channel search
    // which way is this way?
    if (api.writers.user_ids) {
      var nList=[]
      for(var i in api.writers.user_ids) {
        var writer=api.writers.user_ids[i]
        //console.log('channel.controller.js::channelToAPI('+channel.id+') - looking at', writer, 'vs', channel.ownerid)
        if (writer!=channel.ownerid) {
          nList.push(writer)
        }
      }
      //console.log('channel.controller.js::channelToAPI('+channel.id+') - final list', nList)
      api.writers.user_ids=nList
    }
    var ref=this

    var channelDone={
      user: false,
      annotations: false,
      messages: false,
      subscount: false,
    }

    function setDone(type) {
      channelDone[type]=true
      // if something is not done
      //if (channel.debug) {
      //console.log('channel.controller.js::channelToAPI('+channel.id+') - checking if done')
      //}
      for(var i in channelDone) {
        if (!channelDone[i]) {
          if (channel.debug) {
            console.log('channel.controller.js::channelToAPI('+channel.id+') -', i, 'is not done')
          }
          return
        }
      }
      if (channel.debug) {
        console.log('channel.controller.js::channelToAPI('+channel.id+') - done', meta, typeof(callback))
      }
      //console.log('channel.controller.js::channelToAPI('+channel.id+') - done, text', data.text)
      // everything is done
      callback(false, api, meta)
    }

    this.cache.getChannelSubscriptionCount(channel.id, function(err, count) {
      api.counts.subscribers = count
      setDone('subscount')
    })

    function loadUser(userid, params, cb) {
      if (channel.debug) console.log('channel.controller.js::channelToAPI('+channel.id+') - getting user '+userid)
      //params.debug = true
      const dummyUser = {
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
          following: 0,
        }
      }
      if (!userid) {
        return cb(dummyUser, false, false);
      }
      ref.getUser(userid, params, function(userErr, user, userMeta) {
        if (userErr) console.error('channel.controller.js::channelToAPI('+channel.id+') - ', userErr)
        if (channel.debug) console.log('channel.controller.js::channelToAPI('+channel.id+') - got user '+userid)
        if (!user) {
          user = dummyUser
        }
        cb(userErr, user, userMeta)
      }) // getUser
    }

    function loadAnnotation(channel, cb) {
      ref.getAnnotation('channel', channel.id, function(err, dbNotes, noteMeta) {
        var apiNotes=[]
        for(var j in dbNotes) {
          var note=dbNotes[j]
          //console.log('got note', j, '#', note.type, '/', note.value, 'for', posts[i].id)
          apiNotes.push({
            type: note.type,
            value: note.value,
          })
        }
        cb(err, apiNotes, noteMeta)
      })
    }

    //console.log('channel.controller.js::channelToAPI - tokenObj', tokenObj)
    // you_subscribed
    if (tokenObj.subscribedOpt) {
      api.you_subscribed=true
    } else if (tokenObj.unsubscribedOpt) {
      api.you_subscribed=false
    } else {
      if (tokenObj.subscribedOpt===undefined && tokenObj.unsubscribedOpt===undefined) {
        //console.log('channel.controller.js::channelToAPI - are you subscribed?', tokenObj.userid)
        channelDone.subscribed = false
        ref.cache.getSubscription(api.id, tokenObj.userid ? tokenObj.userid : 0, function(err, subed) {
          //console.log('channel.controller.js::channelToAPI - are you subscribed?', subed)
          api.you_subscribed=false
          if (subed) {
            api.you_subscribed=true
          }
          //console.log('channel.controller.js::channelToAPI - are you subscribed?', api.you_subscribed)
          setDone('subscribed')
        })
      }
    }
    if (channel.ownerid == tokenObj.userid) {
      api.readers.you=true
      api.editors.you=true
      api.writers.you=true
      // could insert into user_ids... (Writers is spec)
      // you_can_edit
      api.you_can_edit=true
      // you_muted
      api.you_muted=false // can't mute self
    } else
    //console.log('channel.controller.js::channelToAPI - tokenObj', tokenObj)
    if (tokenObj.userid) {
      // process readers
      if (channel.reader==0) {
        api.readers.you=true
      } else
      // logged in
      if (channel.reader==1) {
        api.readers.you=true
      }

      if (channel.writer==1) {
        api.writers.you=true
      }
      if (!api.writers.you) { // optimization
        var writes=channel.writers?channel.writers.split(/,/):[]
        //console.log('checking', writes, 'for', tokenObj.userid, '=', writes.indexOf(tokenObj.userid+''))
        if (writes.indexOf(tokenObj.userid+'')!=-1) {
          api.writers.you=true
        }
      }
    }
    //if (channel.debug) console.log('asking to load', channel.ownerid)
    loadUser(channel.ownerid, params, function(userErr, user, userMeta) {
      api.owner=user
      //console.log('channel.controller.js::channelToAPI - params', params)
      setDone('user')
    })
    if (params.generalParams.annotations || params.generalParams.post_annotations) {
      loadAnnotation(channel, function(noteErr, apiNotes, noteMeta) {
        api.annotations = apiNotes
        //callback(api, userErr || noteErr)
        setDone('annotations')
      })
    } else {
      //callback(api, userErr)
      setDone('annotations')
    }
    //getChannelMessages function(cid, params, callback) {
    var mParams={ pageParams: { count: 1 }, generalParams: {}, tokenobj: tokenObj }
    this.getChannelMessages(channel.id, mParams, function(messageErr, messages, messageMeta) {
      if (messageErr) console.error('channel.controller::channelToAPI - getChannelMessages', messageErr, 'channel', channel.id)
      if (messages.length) {
        if (messages[0]) {
          api.recent_message_id = messages[0].id
        }
        api.recent_message = messages[0]
      } else {
        console.log('channel.controller.js::channelToAPI - no messages in channel', channel.id)
      }
      setDone('messages')
    })
  },
  /**
   * add/update channel
   * @param {object} json - channel object data
   * @param {number} ts - the timestamp of this event
   * @param {metaCallback} callback - function to call after completion
   */
  setChannel: function(json, ts, callback) {
    if (!json) {
      console.log('channel.controller.js::setChannel - no json passed in')
      callback(false, 'no json passed in')
      return
    }
    // update user object
    this.updateUser(json.owner, ts)
    var ref=this
    // map API to DB
    this.apiToChannel(json, {}, function(channel, convertErr) {
      ref.cache.setChannel(channel, ts, function(err, chnl) {
        // if newer update annotations
        if (callback) {
          callback(err || convertErr, chnl)
        }
      })
    })
    if (this.notsilent) {
      process.stdout.write('C')
    }
  },
  updateChannel: function(channelid, update, params, token, callback) {
    //console.log('channel.controller.js::updateChannel', channelid)
    // The only keys that can be updated are annotations, readers, and writers
    // (and the ACLs can only be updated if immutable=false).
    // The you_can_edit property tells you if you are allowed to update a channel. Currently, only the Channel owner can edit a channel.
    var ref = this
    this.cache.getChannel(channelid, params, function(err, channel, meta) {
      if (err) {
        console.error('channel.controller.js::updateChannel - err', err)
        return callback(err, false, meta)
      }
      if (!channel) {
        console.warn('channel.controller.js::updateChannel - channelid', channelid, 'has no data')
        return callback(false, false, meta)
      }
      //console.log('channel.controller.js::updateChannel - got channel', typeof(channel), channel && Object.keys(channel), channel)
      // FIXME: use apiToChannel
      if (!token.userid || channel.ownerid != token.userid) {
        callback('access denied to channel', {}, {
          code: token?403:401,
        })
        return
      }

      // update readers
      if (update.readers) {
        // can we tell the difference between set and not set?
        // so we can clear?
        if (update.readers.public) {
          channel.reader = 0
        } else
        if (update.readers.any_user) {
          channel.reader = 1
        } else {
          channel.reader = 2
        }
        if (update.readers.user_ids) {
          channel.reader = 2
          channel.readers = update.readers.user_ids.join(',')
        }
      }
      // update writers
      if (update.writers) {
        if (update.writers.any_user) {
          channel.writer = 1
        } else {
          channel.writer = 2
        }
        if (update.writers.user_ids) {
          // has to be an array
          channel.writers = update.writers.user_ids.join(',')
          channel.writer = 2
        } else {
          channel.writers = ''
        }
      }
      //console.log('channel.controller.js::updateChannel - updating channel', channel.id, 'to', channel)
      channel.save(function(){
        //ref.cache.setChannel(channel, Date.now()/1000, function(ochnl, chanUpdErr) {
        //ref.cache.updateChannel(channelid, channel, function(ochnl, chanUpdErr) {
        //console.log('channel.controller.js::updateChannel - chanUpdErr', chanUpdErr)
        // update annotations
        //setAnnotations: function(type, id, annotations, callback) {
        // if it's not set, it'll clear it...
        // If you want to add or update a Channel's annotations, you may include the optional annotations key and pass in the annotations that are changing.
        // it's optional
        if (update.annotations !== undefined) {
          ref.setAnnotations('channel', channelid, update.annotations, function() {
            //console.log('channel.controller.js::updateChannel - annotations set')
            ref.channelToAPI(channel, params, token, callback, meta)
          })
        } else {
          ref.channelToAPI(channel, params, token, callback, meta)
        }
      })
      //})
    })
  },
  addChannel: function(api, params, token, callback) {
    // console.log('channel.controller::addChannel', api, params, token)
    var ref=this
    function createChannel() {
      // Currently, the only keys we use from your JSON will be readers, writers, annotations, and type.
      // The owner will be auto-subscribed to this channel.
      //apiToChannel: function(api, meta, callback) {
      api.owner={}
      ref.apiToChannel(api, {}, function(err, channel, meta) {
        if (err) console.error('channels.controller.js::addChannel - apiToChannel err', err)
        delete channel.id
        ref.cache.addChannel(token.userid, channel, function(createErr, channelRes, createMeta) {
          if (err) console.error('channels.controller.js::addChannel - err', createErr)
          // console.log('channel.controller::addChannel - created channel ID', channelRes.id)
          console.log('channel.controller.js::addChannel - created channel', channelRes)
          ref.setAnnotations('channel', channelRes.id, api.annotations, function() {
            ref.channelToAPI(channelRes, params, token, callback, createMeta)
          })
        })
      })
    }
    if (api.type === 'net.app.core.pm') {
      var group = [token.userid]
      for(var i in api.writers.user_ids) {
        group.push(api.writers.user_ids[i])
      }
      console.log('channel.controller.js::addChannel - detecting pm channel creation, dedupe check for', group)
      // destinations is input string (comma sep list: @,ints)
      this.cache.getPMChannel(group, function(err, nChannel_id, createMeta) {
        if (err) console.error('channels.controller.js::addChannel - getPMChannel err', err)
        console.log('channel.controller.js::addChannel - dedupe result', nChannel_id)
        if (nChannel_id) {
          ref.getChannel(nChannel_id, params, callback)
        } else {
          createChannel()
        }
      })
    } else {
      createChannel()
    }
  },
  deactiveChannel: function(channelid, params, token, callback) {
    var id = parseInt(channelid)
    if (isNaN(id)) {
      console.trace('channels.controller::deactiveChannel - isNaN', channelid, params, token)
      callback('channels.controller::deactiveChannel - isNaN', false)
      return
    }
    //console.log('channels.controller::deactiveChannel', channelid, params, token)
    var ref=this
    // only the owner can deactivate
    this.getChannel(channelid, params, function(err, channel, meta) {
      if (err) console.error('channels.controller::deactiveChannel - getChannel err', err)
      //console.log('ownerid', channel.owner.id, 'token', token.userid, 'channel', channel)
      if (!token.userid || (channel && channel.owner && channel.owner.id != token.userid)) {
        callback({}, 'access denied to channel', {
          code: token?403:401,
        })
        return
      }
      var chnl={
        inactive: new Date(),
      }
      //console.log('channel.controller::deactiveChannel', channelid, params, token)
      ref.cache.updateChannel(channelid, chnl, function(err2, success, meta2) {
        if (err2) console.error('channels.controller::deactiveChannel - err', err2)
        //channel.is_deleted = true
        channel.is_inactive = true
        callback(false, channel, meta)
        //ref.channelToAPI(channel, params, token, callback, meta2)
      })
      // FIXME: get rid of the N+1 and delete all in one query
      ref.cache.getChannelSubscriptions([channelid], { }, function(err, subs, meta) {
        for(var i in subs) {
          var userid = subs[i].userid
          ref.cache.setSubscription(channelid, userid, true, new Date(), function(err, subscription) {
            console.log('channel.controller.js::deactiveChannel - removed a user from channel', channelid)
          })
        }
      })
    })
  },
  checkChannelAccess: function(channel, userid) {
    var allowed=false
    if (channel.reader==0) allowed=true
    else if (userid) {
      if (channel.ownerid==userid) allowed=true
      else if (channel.reader==1) allowed=true
      else if (channel.reader==2) {
        var readList=channel.readers.split(/,/)
        if (readList.indexOf(userid+'')!=-1){
          allowed=true
        }
      }
      //console.log('channel.controller.js::getChannel - allowed', allowed, 'writers', channel.writers, 'looking for', params.tokenobj.userid)
      // pm hack, if you can write to the channel, you can read from it
      if (!allowed && channel.writers) {
        var writeList=channel.writers.split(/,/)
        if (writeList.indexOf(userid+'')!=-1){
          allowed=true
        }
        //console.log('channel.controller.js::getChannel - ', writeList, 'allowed', allowed)
      }
    }
    return allowed
  },
  checkWriteChannelAccess: function(channel, userid) {
    if (!channel) {
      console.trace('channel.controller.js::checkWriteChannelAccess - no channel passed in')
      return false
    }
    var allowed=false
    // maybe throw error if channel isnt an object
    // this isn't a thing in writer mode
    //if (channel.writer==0) allowed=true
    //console.log('channel.controller::checkWriteChannelAccess - userid', userid, 'channel', channel)
    if (userid) { // have to be loggedin to write
      if (channel.ownerid==userid) allowed=true
      else if (channel.writer==1) allowed=true
      else if (channel.writer==2) {
        var writeList=channel.writers.split(/,/)
        if (writeList.indexOf(userid+'')!=-1){
          allowed=true
        }
      }
      //console.log('channel.controller.js::getChannel - allowed', allowed, 'writers', channel.writers, 'looking for', params.tokenobj.userid)
      // pm hack, if you can write to the channel, you can read from it
      /*
      if (!allowed && channel.writers) {
        var writeList=channel.writers.split(/,/)
        if (writeList.indexOf(userid+'')!=-1){
          allowed=true
        }
        //console.log('channel.controller.js::getChannel - ', writeList, 'allowed', allowed)
      }
      */
    }
    return allowed
  },
  getUserChannels: function(params, tokenobj, callback) {
    //console.log('channel.controller::getUserChannels - tokenobj', tokenobj)
    if (!tokenobj.userid) {
      callback('not user token')
      return
    }
    var ref=this
    //console.log('channel.controller::getUserChannels - userid', tokenobj.userid)
    //console.log('channel.controller::getUserChannels - params', params)
    this.cache.getUserChannels(tokenobj.userid, params, function(err, channels, meta) {
      if (err) console.error('channel.controller.js::getUserChannels - getUserChannels err', err)
      //console.log('channel.controller::getUserChannels - channels', channels.length)
      if (!channels || !channels.length) {
        callback(err, [])
        return
      }
      var apis=[]
      for(var i in channels) {
        var channel=channels[i]
        // channel, params, tokenObj, callback, meta
        //console.log('channel.controller::getUserChannels - convert obj', channels[i], 'to API')
        // channelToAPI: function (channel, params, tokenObj, callback, meta) {
        //console.log('asking for', channels[i].id)
        //channels[i].debug = true
        ref.channelToAPI(channels[i], params, params.tokenobj?params.tokenobj:{}, function(cErr, api, meta2) {
          if (cErr) console.error('channel.controller.js::getUserChannels - channelToAPI err', cErr)
          //console.log('channel.controller.js::getUserChannels - got API')
          apis.push(api)
          //console.log('channel.controller.js::getUserChannels - ', channels.length, '/', apis.length)
          if (channels.length == apis.length) {
            //console.log('channel.controller.js::getUserChannels - returning array')
            callback(err || cErr, apis)
          }
        }, meta)
      }
    })
  },
  /**
   * get channel data for specified channel id
   * @param {number} id - the id of channel you're requesting
   * @param {object} param - channel formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannel: function(ids, params, callback) {
    if (ids===undefined || ids === "undefined") {
      console.log('channel.controller.js::getChannel - id was undefined')
      callback('ids was undefined')
      return
    }
    //ids = parseInt(ids)
    //console.log('channel.controller.js::getChannel - ids', ids)
    var ref=this
    this.cache.getChannel(ids, params, function(err, channels, meta) {
      //console.log('channel.controller.js::getChannel - got array', channels)
      if (err) console.error('channel.controller.js::getChannel err -', err)
      if (!channels) {
        callback(err, [], meta)
        return
      }
      //console.log('channel.controller.js::getChannel - got array', channels)
      if (channels instanceof Array) {
        //console.log('channel.controller.js::getChannel - got array', channels.length)
        if (!channels.length) {
          //console.log('channel.controller.js::getChannel multiple - no result for', ids)
          callback(err, [], meta)
          return
        }
        var apis=[]
        for(var i in channels) {
          var channel=channels[i]
          // we can do a quick security check here before pulling it all
          // omitting options will fuck with meta tho
          /*
          var allowed=false
          if (channel.reader==0) allowed=true
          else if (params.tokenobj) {
            if (channel.ownerid==params.tokenobj.userid) allowed=true
            else if (channel.reader==1) allowed=true
            else if (channel.reader==2) {
              var readList=channel.readers.split(/,/)
              if (readList.indexOf(params.tokenobj.userid+'')!=-1){
                allowed=true
              }
            }
            //console.log('channel.controller.js::getChannel - allowed', allowed, 'writers', channel.writers, 'looking for', params.tokenobj.userid)
            // pm hack, if you can write to the channel, you can read from it
            if (!allowed && channel.writers) {
              var writeList=channel.writers.split(/,/)
              if (writeList.indexOf(params.tokenobj.userid+'')!=-1){
                allowed=true
              }
              //console.log('channel.controller.js::getChannel - ', writeList, 'allowed', allowed)
            }
          }
          */
          var allowed=ref.checkChannelAccess(channel, params.tokenobj?params.tokenobj.userid:0)
          // block if not allowed
          if (!allowed) {
            apis.push({ id: channel.id, readers: { user_ids: [] }, writers: { user_ids: [] }, editors: { user_ids: [] } })
            if (channels.length == apis.length) {
              //console.log('channel.controller.js::getChannel - returning array')
              callback(err, apis)
            }
            continue
          }
          //console.log('channel.controller.js::getChannel array - channel', channels[i])
          // channel, params, tokenObj, callback, meta
          ref.channelToAPI(channels[i], params, params.tokenobj?params.tokenobj:{}, function(cErr, api) {
            if (cErr) console.error('channels.controller::getChannel - channelToAPI err', cErr)
            apis.push(api)
            //console.log('channel.controller.js::getChannel - ', channels.length, '/', apis.length)
            if (channels.length == apis.length) {
              //console.log('channel.controller.js::getChannel - returning array')
              callback(cErr, apis)
            }
          })
        }
        return
      }

      // single channel object in channels
      var allowed = ref.checkChannelAccess(channels, params.tokenobj ? params.tokenobj.userid : 0)
      // block if not allowed
      if (!allowed) {
        console.warn(params.tokenobj ? params.tokenobj.userid : 0, 'not allowed to access channel', channels.id)
        ref.channelToAPI({
          id: channels.id
        }, params, params.tokenobj ? params.tokenobj : {}, callback, meta)
        return
      }

      //console.log('channel.controller.js::getChannel single - channel', channels)
      //console.log('channel.controller.js::getChannel - non array')
      // channelToAPI: function (channel, params, tokenObj, callback, meta) {
      ref.channelToAPI(channels, params, params.tokenobj ? params.tokenobj : {}, callback, meta)
    })
  },
  channelSearch: function(criteria, params, tokenObj, callback) {
    var ref = this
    this.cache.searchChannels(criteria, params, function(err, channels, meta) {
      if (err) console.error('channels.controller.js::channelSearch - err', err)
      if (!channels.length) {
        callback(err, [], meta)
        return
      }
      //console.log('channelSearch', channels)
      var apis=[]
      for(var i in channels) {
        var channel=channels[i]
        // we can do a quick security check here before pulling it all
        // omitting options will fuck with meta tho
        // we'll insert dummy stubs
        var allowed=ref.checkChannelAccess(channel, tokenObj.userid)
        // block if not allowed
        if (!allowed) {
          apis.push({ id: channel.id, readers: { user_ids: [] }, writers: { user_ids: [] }, editors: { user_ids: [] } })
          if (channels.length == apis.length) {
            //console.log('channel.controller.js::getChannel - returning array')
            callback(err, apis)
          }
          continue
        }
        // channel, params, tokenObj, callback, meta
        //console.log('channel.controller.js::channelSearch - channel', channel)
        ref.channelToAPI(channel, params, tokenObj, function(cErr, api) {
          if (cErr) console.error('channels.controller.js::channelSearch - channelToAPI err', cErr)
          apis.push(api)
          // todo: sorting by popularity (number of subscriptions)
          // todo: sorting by activity (by recent message)

          //console.log('channel.controller.js::getChannel - ', channels.length, '/', apis.length)
          if (channels.length == apis.length) {
            //console.log('channel.controller.js::getChannel - returning array')
            callback(err || cErr, apis)
          }
        })
      }
    })
  },
}
