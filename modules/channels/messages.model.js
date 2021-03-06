let messageModel
let applyParams

function start(options) {
  const schemaData = options.schemaData
  applyParams = options.applyParams
  /** message storage model */
  messageModel = schemaData.define('message', {
    channel_id: { type: Number, index: true },
    html: { type: schemaData.Text }, /* cache */
    text: { type: schemaData.Text },
    machine_only: { type: Boolean, index: true },
    client_id: { type: String, length: 32 },
    thread_id: { type: Number, index: true },
    userid: { type: Number, index: true },
    reply_to: { type: Number }, // kind of want to index this
    is_deleted: { type: Boolean, index: true },
    created_at: { type: Date }
  })
}

module.exports = {
  next: null,
  start: start,
  /** messages */
  setMessage: function(msg, callback) {
    // If a Message has been deleted, the text, html, and entities properties will be empty and may be omitted.
    //console.log('setMessage - id', msg.id, 'updates', msg)
    // I think this is the controller's responsibility
    // this ops need to be fast, controller needs to be able to handle all input
    //if (msg.channel_id) msg.channel_id = parseInt(msg.channel_id)
    // findOrCreate didn't work
    // updateOrCreate expects a full object
    messageModel.findOne({ where: { id: msg.id } }, function(err, omsg) {
      if (err) console.error('messages.model.js::setMessage - err', err)

      function doCallback(err, fMsg) {
        if (err) {
          console.log('messages.model.js::setMessage:doCallback - err', err)
        }
        // if it's an update fMsg is number of rows affected
        //console.log('setMessage:::doCallback - ', fMsg)
        if (callback) {
          callback(err, fMsg)
        }
      }
      if (omsg) {
        // update
        messageModel.update({ where: { id: msg.id } }, msg, doCallback)
      } else {
        // create
        messageModel.create(msg, doCallback)
      }
    })
  },
  addMessage: function(message, callback) {
    message.is_deleted = 0
    // do we want a layer like this
    // we can detect and handle certain errors
    messageModel.create(message, function(err, omsg) {
      if (err) {
        console.error('messages.model.js::addMessage - err', err)
      }
      if (callback) {
        callback(err, omsg)
      }
    })
  },
  deleteMessage: function(message_id, channel_id, callback) {
    //console.log('messages.model.js::deleteMessage - start', message_id, channel_id)
    const ref = this
    if (!message_id) {
      console.warn('messages.model.js::deleteMessage -  no message_id')
      if (callback) {
        callback(new Error('no message_id'), false)
      }
      return
    }
    messageModel.update({ where: { id: parseInt(message_id) } }, { is_deleted: 1 }, function(err, omsg) {
      if (err) {
        console.log('messages.model.js::deleteMessage - err', err)
      } else {
        //console.log('messages.model.js::deleteMessage - loggin interaction')
        // log delete interaction
        ref.addInteraction('delete', parseInt(channel_id), 'message', parseInt(message_id))
        //ref.setInteraction(parseInt(channel_id), parseInt(message_id), 'delete', 0, 0, Date.now())
      }
      //console.log('messages.model.js::deleteMessage - check cb')
      if (callback) {
        //console.log('messages.model.js::deleteMessage - cb', omsg)
        // omsg is the number of records updated
        // or just the fields changed...
        callback(err, omsg)
      }
    })
  },
  getMessage: function(id, params, callback) {
    if (callback === undefined) {
      console.trace('messages.model.js::getMessage - callback is undefined')
      return
    }
    if (id === undefined) {
      console.trace('messages.model.js::getMessage - id is undefined')
      callback(new Error('id is undefined'))
      return
    }
    if (id === 'undefined') {
      console.trace('messages.model.js::getMessage - id is string undefined')
      callback(new Error('id is undefined'))
      return
    }
    //console.log('dataaccess.caminte.js::getMessage - id', id)
    const criteria = { where: { id: id } }
    // don't include deleted
    if (!params.generalParams.deleted) {
      criteria.where.is_deleted = 0
    }

    if (id instanceof Array) {
      // this wasn't necessary
      const newList = []
      for (const i in id) {
        const val = parseInt(id[i])
        if (val) {
          newList.push(val)
        }
      }
      //console.log('dataaccess.caminte.js::getMessage - newList', newList);
      criteria.where.id = { in: newList }
    }
    //if (params.channelParams && params.channelParams.inactive) {
    //criteria.where['inactive']= { ne: null }
    //}
    const ref = this
    //console.log('messages.model.js::getMessage - criteria', criteria)
    messageModel.find(criteria, function(err, messages) {
      if (err) {
        console.log('dataaccess.caminte.js::getMessage - err', err)
      }
      // console.log('dataaccess.caminte.js::getMessage - messages', JSON.parse(JSON.stringify(messages)))
      if (messages == null && err == null) {
        if (ref.next) {
          ref.next.getMessage(id, callback)
          return
        }
      }
      if (id instanceof Array) {
        //console.log('dataaccess.caminte.js::getMessage multi -', id, messages, messages.length)
        callback(err, messages)
      } else {
        if (!messages.length) {
          return callback(err, {})
        }
        //console.log('dataaccess.caminte.js::getMessage single -', id, messages, messages[0])
        callback(err, messages[0])
      }
    })
  },
  getChannelMessages: function(channelid, params, callback) {
    let query = messageModel.find().where('channel_id', parseInt(channelid))
    //console.log('dataaccess.caminte.js::getChannelMessages - params', params)
    if (params.generalParams.deleted) {
    } else {
      query = query.where('is_deleted', 0)
    }
    //console.log('dataaccess.caminte.js::getChannelMessages - query', query)
    //console.log('dataaccess.camintejs::getChannelMessages - channelid', channelid, 'token', JSON.parse(JSON.stringify(params.tokenobj)))
    if (params.tokenobj && params.tokenobj.userid) {
      const mutedUserIDs = []
      //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
      this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
        if (err) console.error('messages.model.js::getChannelMessages - getAllMutesForUser err', err)
        for (const i in mutes) {
          if (!mutes[i].muteeid) {
            console.warn('messages.model.js::getChannelMessages - no muteeid', mutes[i])
          }
          mutedUserIDs.push(mutes[i].muteeid)
        }
        if (mutedUserIDs.length) {
          query = query.where('userid', { nin: mutedUserIDs })
        }
        //console.log('getChannelMessages - params', params)
        applyParams(query, params, callback)
      })
    } else {
      applyParams(query, params, callback)
    }
  }
}
