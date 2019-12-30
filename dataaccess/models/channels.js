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
    // editors are always seletcive
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
    //console.log('dataaccess.caminte.js::updateChannel - ', channelid, chnl)
    // FIXME: maybe only update channels that are active
    channelModel.update({ id: channelid }, chnl, function(err, channel) {
      if (err) {
        console.error('dataaccess.caminte.js::updateChannel - err', err)
      }
      if (callback) {
        callback(channel, err)
      }
    })
  },
  addChannel: function(userid, channel, callback) {
    //console.log('dataaccess.caminte.js::addChannel - ', userid, channel)
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
    //console.log('dataaccess.caminte.js::addChannel - final obj', obj)
    // not sure create works with memory driver...
    channelModel.create(obj, function(err, ochnl) {
      if (err) {
        console.log('dataaccess.caminte.js::addChannel - create err', err)
      }
      ref.addSubscription(ochnl.id, userid, callback)
      /*
      subscriptionModel.create({
        channelid: ochnl.id,
        userid: userid,
        created_at: now,
        active: true,
        last_updated: now,
      }, function(err, nsub) {
        if (err) {
          console.log('dataaccess.caminte.js::addChannel - subscribe err', err)
        }
        if (callback) {
          callback(ochnl, err)
        }
      })
      */
    })
  },
  // FIXME: call getChannels always return an array
  getChannel: function(id, params, callback) {
    if (id==undefined) {
      console.log('dataaccess.caminte.js::getChannel - id is undefined')
      callback('dataaccess.caminte.js::getChannel - id is undefined', false, false)
      return
    }
    var ref=this
    // null is an object... which breaks the memory type driver rn
    // we'll remove this for now and do our own filtering for now
    // , inactive: null
    var criteria={ where: { id: id, inactive: new Date(0) } }
    if (params.channelParams && params.channelParams.types) {
      criteria.where['type']={ in: params.channelParams.types.split(/,/) }
      //console.log('dataaccess.caminte.js::getChannel - types', criteria.where['type'])
    }
    if (id instanceof Array) {
      criteria.where['id']={ in: id }
    }
    if (params.channelParams && params.channelParams.inactive) {
      criteria.where['inactive']= { ne: new Date(0) }
    }
    //console.log('dataaccess.caminte.js::getChannel - criteria', criteria)
    channelModel.find(criteria, function(err, channels) {
      //console.log('dataaccess.caminte.js::getChannel - found', channels.length)
      //console.log('dataaccess.caminte.js::getChannel - found', channels)
      if (channels==null && err==null) {
        if (ref.next) {
          ref.next.getChannel(id, callback)
          return
        }
      }
      var nchannels = []
      if (params.channelParams && params.channelParams.inactive) {
        // we want inactive
        nchannels = channels
      } else {
        var zeroDate = new Date(0).getTime()
        // we don't want inactive
        for(var i in channels) {
          var channel = channels[i]
          //console.log('dataaccess.caminte.js::getChannel - channel', channel)
          // is it active?
          if (channel.inactive === null || (channel.inactive.getTime && channel.inactive.getTime() === zeroDate)) {
            // add active channels
            nchannels.push(channel)
          }
        }
      }

      //console.log('dataaccess.caminte.js::getChannel - nchannels', nchannels)
      if (id instanceof Array) {
        callback(err, nchannels)
      } else {
        callback(err, nchannels[0])
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
      query = query.where('inactive', { ne: new Date(0) })
    } else {
      query = query.where('inactive', new Date(0))
    }
    // paging is broken because no channel permissions handle after query
    // actually no because we insert blank stubs
    //console.log('dataaccess.caminte.js::searchChannels - query', query.q)
    applyParams(query, params, function(channels, err, meta) {
      callback(channels, err, meta)
    })
  },
  getUserChannels: function(userid, params, callback) {
    if (userid==undefined) {
      console.log('dataaccess.caminte.js::getUserChannels - id is undefined')
      callback('dataaccess.caminte.js::getUserChannels - id is undefined', false, false)
      return
    }
    var ref=this
    var criteria={ where: { ownerid: userid, inactive: new Date(0) } }
    if (params.channelParams && params.channelParams.types) {
      //console.log('dataaccess.caminte.js::getUserChannels - type param', params.channelParams.types)
      criteria.where['type']={ in: params.channelParams.types.split(/,/) }
      //console.log('dataaccess.caminte.js::getUserChannels - types', criteria.where['type'])
    }
    if (params.channelParams && params.channelParams.inactive) {
      criteria.where['inactive']= { ne: new Date(0) }
    }
    //console.log('dataaccess.caminte.js::getUserChannels - criteria', criteria)
    channelModel.find(criteria, function(err, channels) {
      //console.log('dataaccess.caminte.js::getUserChannels - result', channels)
      if (err) {
        console.log('dataaccess.caminte.js::getUserChannels - err', err)
      }
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
      //console.log('dataaccess.caminte.js::getPMChannel - processGroup group in', group.length)
      var groupStr=group.join(',')
      channelModel.find({ where: { type: 'net.app.core.pm', writers: groupStr } }, function(err, channels) {
        if (err) {
          console.log('dataaccess.caminte.js::getPMChannel - err', err)
          callback(0, 'couldnt query existing PM channels')
          return
        }
        if (channels.length > 1) {
          console.log('dataaccess.caminte.js::getPMChannel - too many PM channels for', group)
          callback(0, 'too many PM channels')
          return
        }
        if (channels.length == 1) {
          console.log('dataaccess.caminte.js::getPMChannel - found PM channel', channels[0].id)
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
        console.log('dataaccess.caminte.js::getPMChannel - creating PM channel owned by', group[0])
        ref.addChannel(group[0], {
          type: 'net.app.core.pm',
          reader: 2,
          writer: 2,
          readers: groupStr,
          writers: groupStr,
          editors: groupStr
        }, function(channel, createErr) {
          console.log('dataaccess.caminte.js::getPMChannel - created PM channel', channel.id)
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
    //console.log('dataaccess.caminte.js::getPMChannel - group in', group.length)
    var groupids=[]
    for(var i in group) {
      var user=group[i]+"" // make sure it's a string
      if (user[0]=='@') {
        // username look up
        this.getUserID(user, function(userObj, err) {
          //console.log('dataaccess.caminte.js::getPMChannel - username lookup', userObj, err)
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
