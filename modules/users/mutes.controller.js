module.exports = {
  //
  // mute
  //
  /** mutes */
  //req.params.user_id, req.apiParams, req.usertoken, callbacks.dataCallback(resp)
  getMutes: function(userids, params, tokenObj, callback) {
    var ref = this
    // FIXME: handle arrays?
    this.normalizeUserID(userids, tokenObj, function(err, userid) {
      if (err) console.error('mutes.controller.js::getMutes - normalizeUserID err', err)
      //console.log('mutes.controller.js::getMutes - effective userid', userid)
      ref.cache.getMutes(userid, params, function(err, mutes, meta) {
        if (err) console.error('mutes.controller.js::getMutes - getMutes err', err)
        if (mutes === false || !mutes.length) {
          callback(err, [], meta)
          return
        }
        var userMutes = []
        for(var i in mutes) {
          var userid = mutes[i].muteeid
          // strip paging out params but leave includes
          // FIXME: turn into function
          var nParams = params
          delete nParams.before_id
          delete nParams.since_id
          ref.getUser(userid, nParams, function(user, userErr, userMeta) {
            if (userErr) console.error('mutes.controller.js::getMutes - getUsers err', userEr)
            userMutes.push(user)
            if (mutes.length == userMutes.length) {
              callback(err, userMutes, meta)
            }
          })
        }
      })
    })
  },
  addMute: function(userid, params, tokenObj, callback) {
    var ref = this
    console.log('mutes.controller::addMute', userid, 'for', tokenObj.userid)
    this.cache.addMute(tokenObj.userid, userid, params, function(err, mute) {
      if (err) console.error('mutes.controller.js::addMute - err', err)
      var nParams = params
      delete nParams.before_id
      delete nParams.since_id
      ref.getUser(mute.muteeid, nParams, callback)
    })
  },
  deleteMute: function(userid, params, tokenObj, callback) {
    var ref = this
    console.log('mutes.controller::deleteMute', userid, 'for', tokenObj.userid)
    this.cache.delMute(tokenObj.userid, userid, params, function(err, mute) {
      if (err) console.error('mutes.controller.js::deleteMute - err', err)
      var nParams = params
      delete nParams.before_id
      delete nParams.since_id
      if (mute) {
        ref.getUser(mute.muteeid, nParams, callback)
      } else {
        console.log('mutes.controller::deleteMute - mute not found', userid, 'for', tokenObj.userid)
        callback([], '404 mute not found')
      }
    })
  },
}
