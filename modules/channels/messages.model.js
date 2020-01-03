var messageModel
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
    created_at: { type: Date },
  })
}

module.exports = {
  next: null,
  start: start,
  /** messages */
  setMessage: function (msg, callback) {
    // If a Message has been deleted, the text, html, and entities properties will be empty and may be omitted.
    //console.log('setMessage - id', msg.id, 'updates', msg)
    // findOrCreate didn't work
    // updateOrCreate expects a full object
    messageModel.findOne({ where: { id: msg.id } }, function(err, omsg) {
      function doCallback(err, fMsg) {
        if (err) {
          console.log('setMessage:::doCallback - err', err)
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
    message.is_deleted = true
    messageModel.create(message, function(err, omsg) {
      if (err) {
        console.error('dataaccess.camtine.js::addMessage - err', err)
      }
      if (callback) {
        callback(err, omsg)
      }
    })
  },
  deleteMessage: function (message_id, channel_id, callback) {
    //console.log('dataaccess.camtine.js::deleteMessage - start', message_id, channel_id)
    if (!message_id) {
      console.warn('dataaccess.camtine.js::deleteMessage -  no message_id')
      if (callback) {
        callback('no message_id', false)
      }
      return
    }
    messageModel.update({ where: { id: message_id } }, { is_deleted: true }, function(err, omsg) {
      if (err) {
        console.log('dataaccess.camtine.js::deleteMessage - err', err)
      } else {
        //console.log('dataaccess.camtine.js::deleteMessage - loggin interaction')
        // log delete interaction
        interaction=new interactionModel()
        interaction.userid=channel_id
        interaction.type='delete'
        interaction.datetime=Date.now()
        interaction.idtype='message'
        interaction.typeid=message_id
        //interaction.asthisid=omsg.channel_id
        interaction.save()
      }
      //console.log('dataaccess.camtine.js::deleteMessage - check cb')
      if (callback) {
        //console.log('dataaccess.camtine.js::deleteMessage - cb', omsg)
        // omsg is the number of records updated
        // or just the fields changed...
        callback(err, omsg)
      }
    })
  },
  getMessage: function(id, callback) {
    if (id==undefined) {
      console.trace('dataaccess.caminte.js::getMessage - id is undefined')
      callback('dataaccess.caminte.js::getMessage - id is undefined')
      return
    }
    //console.log('dataaccess.caminte.js::getMessage - id', id)
    var criteria={ where: { id: id, is_deleted: false } }
    if (id instanceof Array) {
      criteria.where['id']={ in: id }
    }
    //if (params.channelParams && params.channelParams.inactive) {
      //criteria.where['inactive']= { ne: null }
    //}
    var ref=this
    messageModel.find(criteria, function(err, messages) {
      if (err) {
        console.log('dataaccess.caminte.js::getMessage - err', err)
      }
      if (messages==null && err==null) {
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
    var ref=this
    var query=messageModel.find().where('channel_id', channelid)
    //console.log('dataaccess.caminte.js::getChannelMessages - params', params)
    if (params.generalParams.deleted) {
    } else {
      query=query.where('is_deleted', false)
    }
    //console.log('dataaccess.caminte.js::getChannelMessages - query', query)
    //console.log('dataaccess.camintejs::getChannelMessages - channelid', channelid, 'token', params.tokenobj)
    if (params.tokenobj && params.tokenobj.userid) {
      var mutedUserIDs = []
      //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
      this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
        for(var i in mutes) {
          mutedUserIDs.push(mutes[i].muteeid)
        }
        query=query.where('userid', { nin: mutedUserIDs })
        //console.log('getChannelMessages - params', params)
        applyParams(query, params, callback)
      })
    } else {
      applyParams(query, params, callback)
    }
  },
}
