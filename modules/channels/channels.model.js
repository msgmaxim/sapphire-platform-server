var channelModel
var applyParams

function start(options) {
  const schemaData = options.schemaData
  applyParams = options.applyParams
  /** channel storage model */
  channelModel = schemaData.define('channel', {
    ownerid: { type: Number, index: true },
    type: { type: String, length: 255, index: true },
    reader: { type: Number }, // 0=public,1=loggedin,2=selective
    writer: { type: Number }, // 1=loggedin,2=selective
    // editors are always selective
    readedit: { type: Boolean, default: true }, // immutable?
    writeedit: { type: Boolean, default: true }, // immutable?
    editedit: { type: Boolean, default: true }, // immutable?
    // could be store as json, since we're parsing either way...
    readers: { type: schemaData.Text }, // comma separate list
    // can't index because text (, index: true)
    writers: { type: schemaData.Text }, // comma separate list (need index for PM channel lookup)
    editors: { type: schemaData.Text }, // comma separate list
    created_at: { type: Date }, // created_at isn't in the API
    inactive: { type: Date }, // date made inactive
    last_updated: { type: Date },
  })
}

module.exports = {
  next: null,
  start: start,
  /** channels */
  setChannel: function (chnl, ts, callback) {
    // created_at vs last_update
    // this only add, does not update
    // findOrCreate
    // updateOrCreate doesn't seem to work on MySQL
    chnl.last_updated=new Date()
    channelModel.updateOrCreate({
      id: chnl.id
    }, chnl, function(err, ochnl) {
      if (callback) {
        callback(ochnl, err)
      }
    })
  },
  updateChannel: function (channelid, chnl, callback) {
    //console.log('channels.model.js::updateChannel - ', channelid, chnl)
    // FIXME: maybe only update channels that are active
    channelModel.update({ id: channelid }, chnl, function(err, channel) {
      if (err) console.error('channels.model.js::updateChannel - err', err)
      if (callback) {
        callback(channel, err)
      }
    })
  },
  addChannel: function(userid, channel, callback) {
    //console.log('channels.model.js::addChannel - ', userid, channel)
    var now=new Date()
    var obj={
      ownerid: userid,
      created_at: now,
      last_updated: now,
      inactive: new Date(0),
      type: channel.type,
      reader: channel.reader,
      writer: channel.writer,
      readers: channel.readers,
      writers: channel.writers,
      editors: channel.editors,
    }
    if (channel.readedit) {
      obj.readedit=channel.readedit
    }
    if (channel.writeedit) {
      obj.writeedit=channel.writeedit
    }
    if (channel.editedit) {
      obj.editedit=channel.editedit
    }
    var ref = this
    //console.log('channels.model.js::addChannel - final obj', obj)
    // not sure create works with memory driver...
    channelModel.create(obj, function(err, ochnl) {
      if (err) console.error('channels.model.js::addChannel - create err', err)
      console.log('channels.model.js::addChannel - final obj', ochnl)
      ref.addSubscription(ochnl.id, userid, function(sErr, subs, meta) {
        if (err) console.error('channels.model.js::addChannel - addSubscription err', sErr)
        if (callback) callback(err || sErr, ochnl)
      })
    })
  },
  // FIXME: call getChannels always return an array
  getChannel: function(id, params, callback) {
    if (id==undefined) {
      console.log('channels.model.js::getChannel - id is undefined')
      callback('id is undefined', false, false)
      return
    }
    var ref=this
    // null is an object... which breaks the memory type driver rn
    // we'll remove this for now and do our own filtering for now
    // , inactive: new Date(0)
    var criteria={ where: { id: parseInt(id), inactive: null } }
    if (params.channelParams && params.channelParams.types) {
      criteria.where['type']={ in: params.channelParams.types.split(/,/) }
      //console.log('channels.model.js::getChannel - types', criteria.where['type'])
    }
    if (id instanceof Array) {
      var cleanArr = []
      for(var i in id) {
        cleanArr.push(parseInt(id[i]))
      }
      criteria.where['id']={ in: cleanArr }
    }
    if (params.channelParams && params.channelParams.inactive) {
      criteria.where['inactive']= { ne: null }
    }
    //console.log('channels.model.js::getChannel - criteria', criteria)
    channelModel.find(criteria, function(err, channels) {
      if (err) console.error('channels.model.js::getChannel - err', err, criteria)
      //console.log('channels.model.js::getChannel - found', channels.length)
      //console.log('channels.model.js::getChannel - found', channels)
      if (!channels) {
        //console.log('channels.model.js::getChannel - no channels for criteria', criteria)
        if (ref.next) {
          ref.next.getChannel(id, callback)
          return
        }
      }
      if (id instanceof Array) {
        callback(err, channels)
      } else {
        callback(err, channels[0])
      }
    })
  },
  searchChannels: function(criteria, params, callback) {
    var query = channelModel.find()
    if (criteria.type) {
      query = query.where('type', criteria.type)
    }
    if (criteria.ownerid) {
      query = query.where('ownerid', criteria.ownerid)
    }
    if (params.channelParams && params.channelParams.inactive) {
      query = query.where('inactive', { ne: null })
    } else {
      query = query.where('inactive', null)
    }
    // paging is broken because no channel permissions handle after query
    // actually no because we insert blank stubs
    //console.log('channels.model.js::searchChannels - query', query.q)
    applyParams(query, params, callback)
  },
  getUserChannels: function(userid, params, callback) {
    if (userid === undefined) {
      console.trace('channels.model.js::getUserChannels - id is undefined')
      callback('channels.model.js::getUserChannels - id is undefined', false, false)
      return
    }
    var ref=this
    // , inactive: new Date(0)
    var criteria={ where: { ownerid: parseInt(userid), inactive: null } }
    if (params.channelParams && params.channelParams.types) {
      //console.log('channels.model.js::getUserChannels - type param', params.channelParams.types)
      criteria.where['type']={ in: params.channelParams.types.split(/,/) }
      //console.log('channels.model.js::getUserChannels - types', criteria.where['type'])
    }
    if (params.channelParams && params.channelParams.inactive) {
      criteria.where['inactive']= { ne: null }
    }
    //console.log('channels.model.js::getUserChannels - criteria', criteria, criteria.where)
    channelModel.find(criteria, function(err, channels) {
      //console.log('channels.model.js::getUserChannels - result', channels)
      if (err) console.error('channels.model.js::getUserChannels - err', err)
      if (channels==null && err==null) {
        if (ref.next) {
          ref.next.getUserChannels(userid, params, callback)
          return
        }
      }
      callback(err, channels)
    })
    return
  },
  // group is an array of user IDs
  // shouldn't it be dispatchers job to do the user lookup
  // so it can hit any caching layer
  getPMChannel: function(group, callback) {
    var ref=this
    function processGroup(group) {
      //console.log('channels.model.js::getPMChannel - processGroup group in', group.length)
      var groupStr=group.join(',')
      channelModel.find({ where: { type: 'net.app.core.pm', writers: groupStr } }, function(err, channels) {
        if (err) {
          console.log('channels.model.js::getPMChannel - err', err)
          callback(0, 'couldnt query existing PM channels')
          return
        }
        if (channels.length > 1) {
          console.log('channels.model.js::getPMChannel - too many PM channels for', group)
          callback(0, 'too many PM channels')
          return
        }
        if (channels.length == 1) {
          console.log('channels.model.js::getPMChannel - found PM channel', channels[0].id)
          // make sure all users in the group are resub'd
          var ts = Date.now()
          for(var i in group) {
            var user=group[i]
            ref.setSubscription(channels[0].id, user, 0, ts)
            /*
            subscriptionModel.updateOrCreate({ channelid: channels[0].id, userid: user }, {
              active: 1
            }, function() {
            })
            */
          }
          callback(channels[0].id, '')
          return
        }
        // create
        console.log('channels.model.js::getPMChannel - creating PM channel owned by', group[0])
        ref.addChannel(group[0], {
          type: 'net.app.core.pm',
          reader: 2,
          writer: 2,
          readers: groupStr,
          writers: groupStr,
          editors: groupStr
        }, function(channel, createErr) {
          console.log('channels.model.js::getPMChannel - created PM channel', channel.id)
          //channel.writers=groupStr
          //channel.save(function() {
          for(var i in group) {
            var user=group[i]
            ref.setSubscription(channel.id, user, 0, ts)
            /*
            subscriptionModel.updateOrCreate({ channelid: channel.id, userid: user }, {
              active: 1
            }, function() {
            })
            */
          }
          callback(channel.id, '')
          //})
        })
      })
    }
    //console.log('channels.model.js::getPMChannel - group in', group.length)
    var groupids=[]
    for(var i in group) {
      var user=group[i]+"" // make sure it's a string
      if (user[0]=='@') {
        // username look up
        this.getUserID(user, function(userObj, err) {
          //console.log('channels.model.js::getPMChannel - username lookup', userObj, err)
          if (userObj) {
            groupids.push(userObj.id)
          } else {
            groupids.push(null)
          }
          if (groupids.length == group.length) {
            processGroup(groupids)
          }
        })
      } else {
        groupids.push(user)
        if (groupids.length == group.length) {
          processGroup(groupids)
        }
      }
    }
  },
}
