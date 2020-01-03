module.exports = {
  //
  // mute
  //
  /** mutes */
  //req.params.user_id, req.apiParams, req.usertoken, callbacks.dataCallback(resp)
  getMutes: function(userids, params, tokenObj, callback) {
    var ref = this
    var userid = userids
    if (userids == 'me') {
      userid = tokenObj.userid
    }
    this.cache.getMutes(userid, params, function(err, mutes, meta) {
      if (mutes === false || !mutes.length) {
        callback([], err, meta)
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
          userMutes.push(user)
          if (mutes.length == userMutes.length) {
            callback(userMutes, err, meta)
          }
        })
      }
    })
  },
  addMute: function(userid, params, tokenObj, callback) {
    var ref = this
    console.log('dispatcher::addMute', userid, 'for', tokenObj.userid)
    this.cache.addMute(tokenObj.userid, userid, params, function(err, mute) {
      var nParams = params
      delete nParams.before_id
      delete nParams.since_id
      ref.getUser(mute.muteeid, nParams, callback)
    })
  },
  deleteMute: function(userid, params, tokenObj, callback) {
    var ref = this
    console.log('dispatcher::deleteMute', userid, 'for', tokenObj.userid)
    this.cache.delMute(tokenObj.userid, userid, params, function(err, mute) {
      var nParams = params
      delete nParams.before_id
      delete nParams.since_id
      if (mute) {
        ref.getUser(mute.muteeid, nParams, callback)
      } else {
        console.log('dispatcher::deleteMute - mute not found', userid, 'for', tokenObj.userid)
        callback([], '404 mute not found')
      }
    })
  },
}
