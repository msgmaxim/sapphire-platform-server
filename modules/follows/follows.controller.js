module.exports = {
  /** user_follow */
  setFollows: function(data, deleted, id, ts, callback) {
    //console.log('dispatcher.js::setFollows - data', data)
    // data can be null
    if (data) {
      //console.log('dispatcher.js::setFollows - has data')
      // update user object
      // so we need the username check
      // because user/ID/follow calls this without looking up the complete user
      if (data.user && data.user.username) {
        this.updateUser(data.user, ts)
      //} else {
        //console.log('dispatcher.js::setFollows - no user', data)
      }
      // update user object
      if (data.follows_user && data.follows_user.username) {
        this.updateUser(data.follows_user, ts)
      //} else {
        //console.log('dispatcher.js::setFollows - no follows_user', data)
      }
      // set relationship status
      //console.log('dispatcher.js::setFollows - has data', data.user.id, data.follows_user.id, 'id', id, 'deleted', deleted, 'ts', ts)
      // probably dont' need this first one but we're an internal API
      // maybe something will need it eventually
      var ref = this
      this.normalizeUserID(data.user.id, {}, function(err, normalUserId) {
        ref.normalizeUserID(data.follows_user.id, {}, function(err, normalFollowId) {
          ref.cache.setFollow(normalUserId, normalFollowId, id, deleted, ts)
        })
      })
    } else {
      // likely deleted is true in this path
      this.cache.setFollow(0, 0, id, deleted, ts)
    }
    if (this.notsilent) {
      process.stdout.write(deleted?'f':'F')
    }
    if (callback) {
      callback()
    }
  },
  getFollowings: function(user, params, tokenObj, callback) {
    //console.log('dispatcher.js::getFollowing - for', userid)
    var ref=this
    this.normalizeUserID(user, tokenObj, function(err, userid) {
      ref.cache.getFollowing(userid, params, function(err, follows, meta) {
        if (err || !follows || !follows.length) {
          callback(err, [])
          return
        }
        var users=[]
        //console.log('dispatcher.js::getFollowing', follows.length)
        var min_id = 9999
        var max_id = 0
        for(var i in follows) {
          min_id=Math.min(min_id, follows[i].id)
          max_id=Math.max(max_id, follows[i].id)
          var scope=function(i) {
            ref.getUser(follows[i].followsid, { tokenobj: tokenObj }, function(err, user) {
              if (err) {
                console.error('dispatcher.js::getFollowers - err', err)
              }
              if (!user) {
                console.log('dispatcher.js::getFollowers - empty user gotten for', follows[i].userid)
                user = {} // fix it so setting pagination doesn't crash
              }
              /*
              if (!user.avatar_image.url) {
                user.avatar_image.url='http://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
                user.avatar_image.height=128
                user.avatar_image.width=128
              }
              */
              //console.log('dispatcher.js::getFollowing - adding user', user)
              // alpha needs this dummy wrapper
              // but it's against spec
              /*
              var obj={
                id: 0,
                text: 'alpha hack',
                created_at: '2014-10-24T17:04:48Z',
                source: {

                },
                user: user
              }
              */
              user.pagination_id = follows[i].id
              users.push(user)
              if (users.length==follows.length) {
                // supposed to return meta too
                var imeta={
                  code: 200,
                  min_id: min_id,
                  max_id: max_id,
                  more: users.length==params.count
                }
                callback(err, users, imeta)
              }
            })
          }(i)
        }
      })
    })
  },
  getFollowers: function(user, params, tokenObj, callback) {
    //console.log('dispatcher.js::getFollowers - for', userid)
    var ref=this
    this.normalizeUserID(user, tokenObj, function(err, userid) {
      ref.cache.getFollows(userid, params, function(err, follows, meta) {
        if (err || !follows || !follows.length) {
          if (err) console.error('dispatcher::getFollowers', err)
          callback(err, [])
          return
        }
        var users=[]
        //console.log('dispatcher.js::getFollowers', follows.length)
        for(var i in follows) {
          ref.getUser(follows[i].userid, { tokenobj: tokenObj }, function(err, user) {
            if (err) {
              console.error('dispatcher.js::getFollowers - err', err)
            }
            if (!user) {
              console.log('dispatcher.js::getFollowers - empty user gotten for', follows[i].userid)
            }
            //console.log('dispatcher.js::getFollowers - adding user', user)
            // alpha needs this dummy wrapper
            // but it's against spec
            /*
            var obj={
              id: 0,
              text: 'alpha hack',
              created_at: '2014-10-24T17:04:48Z',
              source: {

              },
              user: user
            }
            */
            users.push(user)
            //console.log('dispatcher.js::getFollowers - users', users.length, 'follows', follows.length)
            if (users.length==follows.length) {
              // supposed to return meta too
              callback(err, users, meta)
            }
          })
        }
      })
    })
  },
}
