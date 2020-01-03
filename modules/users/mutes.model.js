let muteModel
let applyParams

function start(options) {
  const schemaData = options.schemaData
  applyParams = options.applyParams
  muteModel = schemaData.define('mute', {
    userid: { type: Number, index: true },
    muteeid: { type: Number }
  })
}

module.exports = {
  next: null,
  start: start,
  getMutes: function(userid, params, callback) {
    var userid = parseInt(userid)
    if (isNaN(userid)) {
      callback('invalid userid', false, false)
      return
    }
    applyParams(muteModel.find().where('userid', { in: userid }), params, function(mutes, err, meta) {
      callback(mutes, err, meta)
    })
  },
  getAllMutesForUser: function(userid, callback) {
    var mutedUserIDs = []
    muteModel.find({ where: { 'userid': { in: userid } } }, function(err, mutes) {
      for(var i in mutes) {
        mutedUserIDs.push(mutes[i].muteeid)
      }
      callback(mutedUserIDs)
    })
  },
  addMute: function(userid, muteeid, params, callback) {
    //console.log('dataaccess.caminte::addMute', muteeid, 'for', userid, typeof(callback))
    var crit = { userid: userid, muteeid: muteeid }
    muteModel.findOne({ where: crit }, function(err, mute) {
      //console.log('dataaccess.caminte::addMute - mute', mute)
      if (err) console.log('dataaccess.caminte::addMute - err', err, mute)
      if (!mute) {
        //console.log('dataaccess.caminte::addMute - creating mute')
        muteModel.create(crit, callback)
      } else {
        callback(err, mute)
      }
    })
  },
  delMute: function(userid, muteeid, params, callback) {
    //console.log('dataaccess.caminte::delMute', muteeid, 'for', userid, typeof(callback))
    muteModel.findOne({ where: { userid: userid, muteeid: muteeid } }, function(err, mute) {
      if (err) {
        console.log('dataaccess.caminte::delMute - find err', err, mute)
        callback(err)
      }
      if (mute) {
        /*
        muteModel.destroyById(mute.id, function(dErr) {
          console.log('dataaccess.caminte::delMute - dErr', dErr)
          callback(mute, err)
        })
        */
        mute.destroy(function(dErr) {
          if (dErr) console.log('dataaccess.caminte::delMute - destroy err', dErr)
          callback(dErr, mute)
        })
      } else {
        callback(err, mute)
      }
    })
  },
}
