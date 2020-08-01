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
  getMutes: function(pUserid, params, callback) {
    const userid = parseInt(pUserid)
    if (isNaN(userid)) {
      callback(new Error('invalid userid'), false, false)
      return
    }
    applyParams(muteModel.find().where('userid', { in: userid }), params, callback)
  },
  getAllMutesForUser: function(userid, callback) {
    if (!Array.isArray(userid)) userid = [userid]
    //console.log('mutes.model.js::getAllMutesForUser - userid', userid)
    muteModel.find({ where: { userid: { in: userid } } }, function(err, mutes) {
      if (err) console.error('mutes.model.js::getAllMutesForUser - err', err)
      //console.log('mutes.model.js::getAllMutesForUser - mutes', mutes)
      const mutedUserIDs = []
      for (const i in mutes) {
        if (mutes[i] && mutes[i].muteeid) {
          mutedUserIDs.push(mutes[i].muteeid)
        } else {
          // console.error('mutes.model.js::getAllMutesForUser - what is the driver doing', mutes, 'for', userid)
        }
      }
      callback(null, mutedUserIDs)
    })
  },
  addMute: function(userid, muteeid, params, callback) {
    //console.log('dataaccess.caminte::addMute', muteeid, 'for', userid, typeof(callback))
    const crit = { userid: parseInt(userid), muteeid: muteeid }
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
    muteModel.findOne({ where: { userid: parseInt(userid), muteeid: muteeid } }, function(err, mute) {
      if (err) {
        console.log('dataaccess.caminte::delMute - find err', err, mute)
        return callback(err)
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
  }
}
