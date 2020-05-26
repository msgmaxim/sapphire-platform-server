var userModel

var applyParams

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  schemaData = modelOptions.schemaData
  /** user storage model */
  userModel = schemaData.define('user', {
    /* API START */
    username: { type: String, length: 21, index: true },
    name: { type: String, length: 50 },
    description: { type: schemaData.Text },
    descriptionhtml: { type: schemaData.Text }, /* cache */
    created_at: { type: Date },
    timezone: { type: String, length: 64 },
    // maybe remove this?
    locale: { type: String, length: 16 },
    // this will need to change, so we can support multiples?
    avatar_image: { type: String, length: 255 },
    avatar_width: { type: Number } ,
    avatar_height: { type: Number } ,
    cover_image: { type: String, length: 255 },
    cover_width: { type: Number } ,
    cover_height: { type: Number } ,
    // is_default?
    following: { type: Number, default: 0 }, /* cache */
    followers: { type: Number, default: 0 }, /* cache */
    posts: { type: Number, default: 0 }, /* cache */
    stars: { type: Number, default: 0 }, /* cache */
    deleted: { type: Date },
    type: { type: String, length: 32 },
    canonical_url: { type: String, length: 255 },
    verified_domain: { type: String, length: 255 },
    verified_link: { type: String, length: 255 },
    /* API END */
    last_updated: { type: Date },
    stars_updated: { type: Date },
    language: { type: String, length: 2 },
    country: { type: String, length: 2 },
  })
  userModel.validatesUniquenessOf('username', {message:'username is not unique'})
}

module.exports = {
  next: null,
  start: start,
  /*
   * users
   */
  /**
   * add User camintejs
   * @param {string} username - name of user
   * @param {string} password - unencrypted password of user
   * @param {metaCallback} callback - function to call after completion
   */
  addUser: function(username, password, callback) {
    userModel.create({
        username: username,
        /*
        canonical_url: null,
        type: null,
        timezone: null,
        locale: null,
        */
        //password: password,
        created_at: Date.now(),
        active: true,
      }, callback)
  },
  setUser: function(iuser, ts, callback) {
    // FIXME: check ts against last_update to make sure it's newer info than we have
    // since we have cached fields
    //console.log('camtinejs::setUser - iuser', iuser)
    // doesn't overwrite all fields
    userModel.findOne({ where: { id: iuser.id } }, function(err, user) {
      //console.log('camtinejs::setUser - got res', user)
      if (user) {
        //console.log('camtinejs::setUser - updating user', user.id)
        if (iuser.descriptionhtml === undefined) iuser.descriptionhtml = ''
        userModel.update({ where: { id: iuser.id } }, iuser, callback)
      } else {
        //console.log('camtinejs::setUser - creating user')
        db_insert(new userModel(iuser), userModel, callback)
      }
    })
  },
  patchUser: function(userid, changes, callback) {
    userModel.update({ where: { id: userid } }, changes, callback)
  },
  updateUserCounts: function(userid, callback) {
    var ref=this
    userModel.findById(userid, function(err, user) {
      if (!user) {
        console.log('updateUserCounts no user', user, 'for id', userid)
        if (callback) {
          callback()
        }
        return
      }
      // this may only return up to 20, we'll need to set count=-1

      /*
      postModel.count({ where: { userid: userid } }, function(err, postCount) {
        if (err) console.error('updateUserCounts - posts:', err)
        user.posts = postCount
        user.save()
      })
      followModel.count({ where: { userid: userid } }, function(err, followingCount) {
        if (err) console.error('updateUserCounts - following:', err)
        user.following = followingCount
        user.save()
      })
      followModel.count({ where: { followsid: userid } }, function(err, followerCount) {
        if (err) console.error('updateUserCounts - follower:', err)
        user.followers = followerCount
        user.save()
      })
      // FIXME: deleted stars? unstars?
      interactionModel.count({ where: { userid: userid, type: 'star' } }, function(err, starCount) {
        if (err) console.error('updateUserCounts - star:', err)
        user.stars=starCount
        user.save()
      })
      */

    })
    // tight up later
    if (callback) {
      callback()
    }
  },
  delUser: function(userid, callback) {
    if (this.next) {
      this.next.delUser(userid, callback)
    } else {
      if (callback) {
        callback(false, false)
      }
    }
  },
  getUserID: function(username, callback) {
    //console.log('dataaccess.caminte.js::getUserID(', username, ') - start')
    if (!username) {
      console.log('dataaccess.caminte.js::getUserID() - username was not set')
      callback('dataaccess.caminte.js::getUserID() - username was not set', false)
      return
    }
    // probably should move this into dispatcher?
    if (username[0]==='@') {
      username = username.substr(1)
    }
    var ref=this
    var username=username.toLowerCase()
    userModel.findOne({ where: { username: username }}, function(err, user) {
      // we're the root/seed, if ref.next is set then we're just a cache
      if (user==null && err==null) {
        if (ref.next) {
          ref.next.getUserID(username, callback)
          return
        }
      }
      callback(err, user)
    })
  },
  // we only support integers unlike getUser
  getUser: function(userid, callback) {
    if (userid == undefined) {
      console.trace('dataaccess.caminte.js:getUser - userid is undefined')
      callback('dataaccess.caminte.js:getUser - userid is undefined')
      return
    }
    if (!userid) {
      console.log('dataaccess.caminte.js:getUser - userid isn\'t set')
      callback('dataaccess.caminte.js:getUser - userid isn\'t set')
      return
    }
    if (callback == undefined) {
      console.trace('dataaccess.caminte.js:getUser - callback is undefined')
      callback('dataaccess.caminte.js:getUser - callback is undefined')
      return
    }
    //console.log('dataaccess.caminte.js:getUser - userid', userid)
    if (userid[0]==='@') {
      //console.log('dataaccess.caminte.js:getUser - getting by username')
      this.getUserID(userid.substr(1), callback)
      return
    }
    if (isNaN(userid)) {
      console.log('dataaccess.caminte.js:getUser - userid isn\'t a number')
      var stack = new Error().stack
      console.error(stack)
      callback('dataaccess.caminte.js:getUser - userid isn\'t a number')
      return
    }
    var ref = this
    //console.log('dataaccess.caminte.js:getUser - getting', userid)
    userModel.findById(userid, function(err, user) {
      //console.log('dataaccess.caminte.js:getUser - got', user)
      if (user==null && err==null) {
        if (ref.next) {
          ref.next.getUser(userid, callback)
          return
        }
      }
      callback(err, user)
    })
  },
  getUsers: function(userids, params, callback) {
    if (!userids.length) {
      console.log('dataaccess.caminte::getUsers - no userids passed in')
      callback([], 'did not give a list of userids')
      return
    }
    applyParams(userModel.find().where('id', { in: userids }), params, 0, function(posts, err, meta) {
      callback(posts, err, meta)
    })
  },
  searchUsers: function(query, params, callback) {
    // username, name, description
    var userids={}
    var done={
      username: false,
      name: false,
      description: false,
    }
    function setDone(sys) {
      var ids=[]
      for(var i in userids) {
        ids.push(i)
      }
      //console.log('searchUsers', sys, ids.length)
      done[sys]=true
      for(var i in done) {
        if (!done[i]) {
          //console.log('searchUsers -', i, 'is not done')
          return
        }
      }
      //console.log('dataaccess.caminte::searchUsers done', ids.length)
      if (!ids.length) {
        callback(false, [], { code: 200, more: false })
        return
      }
      applyParams(userModel.find().where('id', { in: ids }), params, callback)
    }
    userModel.find({ where: { username: { like : '%' + query + '%' }} }, function(err, users) {
      for(var i in users) {
        userids[users[i].id]++
      }
      setDone('username')
    })
    userModel.find({ where: { name: { like : '%' + query + '%' }} }, function(err, users) {
      for(var i in users) {
        userids[users[i].id]++
      }
      setDone('name')
    })
    userModel.find({ where: { description: { like : '%' + query + '%' }} }, function(err, users) {
      for(var i in users) {
        userids[users[i].id]++
      }
      setDone('description')
    })
  },
}
