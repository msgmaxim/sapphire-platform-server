let UserModel

let applyParams, schemaData

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  schemaData = modelOptions.schemaData
  /** user storage model */
  UserModel = schemaData.define('user', {
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
    avatar_width: { type: Number },
    avatar_height: { type: Number },
    cover_image: { type: String, length: 255 },
    cover_width: { type: Number },
    cover_height: { type: Number },
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
    country: { type: String, length: 2 }
  })
  UserModel.validatesUniquenessOf('username', { message: 'username is not unique' })
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
    UserModel.create({
      username: username,
      /*
        canonical_url: null,
        type: null,
        timezone: null,
        locale: null,
        */
      //password: password,
      created_at: Date.now(),
      active: true
    }, callback)
  },
  setUser: function(iuser, ts, callback) {
    // FIXME: check ts against last_update to make sure it's newer info than we have
    // since we have cached fields
    //console.log('camtinejs::setUser - iuser', iuser)
    // doesn't overwrite all fields
    UserModel.findOne({ where: { id: iuser.id } }, function(err, user) {
      if (err) console.error('users.model.js::setUser - err', err)
      //console.log('camtinejs::setUser - got res', user)
      if (user) {
        //console.log('camtinejs::setUser - updating user', user.id)
        if (iuser.descriptionhtml === undefined) iuser.descriptionhtml = ''
        UserModel.update({ where: { id: iuser.id } }, iuser, callback)
      } else {
        //console.log('camtinejs::setUser - creating user')
        const userRec = new UserModel(iuser)
        userRec.save(function(err) {
          callback(err, userRec)
        })
      }
    })
  },
  patchUser: function(userid, changes, callback) {
    // returns number of records updated
    UserModel.update({ where: { id: userid } }, changes, callback)
  },
  updateUserCounts: function(userid, callback) {
    UserModel.findById(userid, function(err, user) {
      if (err) console.error('users.model.js::updateUserCounts - err', err)
      if (!user) {
        console.log('users.model.js::updateUserCounts no user', user, 'for id', userid)
        if (callback) {
          callback()
        }
      }
      // this may only return up to 20, we'll need to set count=-1
      console.log('users.model.js::updateUserCounts - fix me!')

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
        callback(null, false)
      }
    }
  },
  getUserID: function(pUsername, callback) {
    //console.log('dataaccess.caminte.js::getUserID(', username, ') - start')
    let username = pUsername.toLowerCase()
    if (!username) {
      console.log('users.model.js::getUserID() - username was not set')
      callback(new Error('users.model.js::getUserID() - username was not set'), false)
      return
    }
    // probably should move this into dispatcher?
    if (username[0] === '@') {
      username = username.substr(1)
    }
    const ref = this
    UserModel.findOne({ where: { username: username } }, function(err, user) {
      // we're the root/seed, if ref.next is set then we're just a cache
      if (user === null && err === null) {
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
    if (userid === undefined) {
      console.trace('users.model.js:getUser - userid is undefined')
      callback(new Error('users.model.js:getUser - userid is undefined'))
      return
    }
    if (!userid) {
      console.log('users.model.js:getUser - userid isn\'t set')
      callback(new Error('users.model.js:getUser - userid isn\'t set'))
      return
    }
    if (callback === undefined) {
      console.trace('users.model.js:getUser - callback is undefined')
      callback(new Error('users.model.js:getUser - callback is undefined'))
      return
    }
    //console.log('dataaccess.caminte.js:getUser - userid', userid)
    if (userid[0] === '@') {
      //console.log('dataaccess.caminte.js:getUser - getting by username')
      this.getUserID(userid.substr(1), callback)
      return
    }
    if (isNaN(userid)) {
      console.log('users.model.js:getUser - userid isn\'t a number')
      const stack = new Error().stack
      console.error(stack)
      callback(new Error('users.model.js:getUser - userid isn\'t a number'))
      return
    }
    const ref = this
    //console.log('dataaccess.caminte.js:getUser - getting', userid)
    UserModel.findById(userid, function(err, user) {
      //console.log('dataaccess.caminte.js:getUser - got', user)
      if (user === null && err === null) {
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
      console.log('users.model::getUsers - no userids passed in')
      callback(new Error('did not give a list of userids'), [])
      return
    }
    //console.log('users.model::getUsers - userids', userids)
    applyParams(UserModel.find().where('id', { in: userids }), params, function(err, users, meta) {
      if (err) console.error('users.model::getUsers - err', err)
      callback(err, users, meta)
    })
  },
  searchUsers: function(query, params, callback) {
    // username, name, description
    const userids = {}
    const done = {
      username: false,
      name: false,
      description: false
    }
    function setDone(sys) {
      const ids = []
      for (const i in userids) {
        ids.push(i)
      }
      //console.log('searchUsers', sys, ids.length)
      done[sys] = true
      for (const i in done) {
        if (!done[i]) {
          //console.log('searchUsers -', i, 'is not done')
          return
        }
      }
      //console.log('dataaccess.caminte::searchUsers done', ids.length)
      if (!ids.length) {
        callback(null, [], { code: 200, more: false })
        return
      }
      applyParams(UserModel.find().where('id', { in: ids }), params, callback)
    }
    UserModel.find({ where: { username: { like: '%' + query + '%' } } }, function(err, users) {
      if (err) console.error('users.model.js::searchUsers - username err', err)
      for (const i in users) {
        userids[users[i].id]++
      }
      setDone('username')
    })
    UserModel.find({ where: { name: { like: '%' + query + '%' } } }, function(err, users) {
      if (err) console.error('users.model.js::searchUsers - name err', err)
      for (const i in users) {
        userids[users[i].id]++
      }
      setDone('name')
    })
    UserModel.find({ where: { description: { like: '%' + query + '%' } } }, function(err, users) {
      if (err) console.error('users.model.js::searchUsers - description err', err)
      for (const i in users) {
        userids[users[i].id]++
      }
      setDone('description')
    })
  }
}
