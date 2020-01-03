// copyentities
const entitiesController = require('../channels/entities.controller')

module.exports={
  //
  // user
  //
  /**
   * add/update user object
   * @param {object} data - user stream object
   * @param {number} ts - timestamp of event
   * @param {metaCallback} callback - function to call after completion
   */
  updateUser: function(data, ts, callback) {
    if (!data) {
      console.log('dispatcher.js:updateUser - data is missing', data)
      callback(null, 'data is missing')
      return
    }
    if (!data.id) {
      console.log('dispatcher.js:updateUser - id is missing', data)
      callback(null, 'id is missing')
      return
    }
    // FIXME: current user last_updated
    var ref=this
    if (data.annotations) {
      //console.log('dispatcher.js:updateUser - hasNotes, userid', data.id, 'notes', data.annotations, 'full', data)
      // FIXME: only updated annotation if the timestamp is newer than we have
      this.setAnnotations('user', data.id, data.annotations)
    }
    // fix api/stream record in db format
    this.apiToUser(data, function(userData) {
      //console.log('made '+data.created_at+' become '+userData.created_at)
      // can we tell the difference between an add or update?
      //console.log('dispatcher.js::updateUser - final', userData)
      ref.cache.setUser(userData, ts, function(err, user, meta) {
        // TODO: define signal if ts is old
        if (callback) {
          callback(user, err, meta)
        }
      })
    })
    /*
    userData.username=data.username.toLowerCase() // so we can find it
    userData.created_at=new Date(data.created_at) // fix incoming created_at iso date to Date
    // if there isn't counts probably a bad input
    if (data.counts) {
      userData.following=data.counts.following
      userData.followers=data.counts.followers
      userData.posts=data.counts.posts
      userData.stars=data.counts.stars
    }
    // set avatar to null if is_default true
    userData.avatar_width=data.avatar_image.width
    userData.avatar_height=data.avatar_image.height
    userData.avatar_image=data.avatar_image.url
    userData.cover_width=data.cover_image.width
    userData.cover_height=data.cover_image.height
    userData.cover_image=data.cover_image.url

    if (data.description) {
      //console.log('user '+data.id+' has description', data.description.entities)
      if (data.description.entities) {
        //console.log('user '+data.id+' has entities')
        this.setEntities('user', data.id, data.description.entities, function(entities, err) {
          if (err) {
            console.log("entities Update err: "+err)
          //} else {
            //console.log("entities Updated")
          }
        })
      }
      // cache html version
      userData.descriptionhtml=data.description.html
      // since userData is a reference to data, we can't stomp on it until we're done
      userData.description=data.description.text
    }
    */

    if (this.notsilent) {
      process.stdout.write('U')
    }
  },
  patchUser: function(request, params, tokenObj, callback) {
    /*
        name: req.body.name,
        locale: req.body.locale,
        timezone: req.body.timezone,
        description: req.body.description,
    */
    var changes={}
    if (request.name!==undefined) changes.name=request.name
    if (request.locale!==undefined) changes.locale=request.locale
    if (request.timezone!==undefined) changes.timezone=request.timezone
    if (request.description!==undefined) {
      if (request.description.text) changes.description=request.description.text
      if (request.description.html) changes.descriptionhtml=request.description.html
    }
    //console.log("dispatcher.js::patchUser - user", tokenObj.userid, 'changes', changes)
    // params we'd have to pay attention to:
    // include_annotations, include_user_annotations, include_html
    var ref=this
    if (request.annotations) {
      //console.log('dispatcher.js::patchUser - annotations', request.annotations)
      this.setAnnotations('user', tokenObj.userid, request.annotations)
    }
    //console.log('dispatcher.js::patchUser - changes', changes)
    if (JSON.stringify(changes) === '{}') {
      return
    }
    this.cache.patchUser(tokenObj.userid, changes, function(err, user, meta) {
      if (err) console.error('dispatcher.js::patchUser - err', err)
      if (callback) {
        ref.userToAPI(user, tokenObj, function(apiUser, apiErr, apiMeta) {
          callback(apiUser, apiErr, apiMeta)
        }, meta)
      }
    })
  },
  updateUserAvatar: function(avatar_url, params, tokenObj, callback) {
    if (!tokenObj.userid) {
      console.trace('dispatcher.js::updateUserAvatar - no user id in tokenObj', tokenObj, tokenObj.userid)
      return callback({}, 'not userid')
    }
    //console.log('dispatcher.js::updateUserAvatar - avatar', avatar_url)
    // we can also set the image width/height...
    changes = {
      avatar_image: avatar_url
    }
    var ref=this
    this.cache.patchUser(tokenObj.userid, changes, function(changes, err, meta) {
      // hrm memory driver does return the complete object...
      //console.log('dispatcher.js::updateUserAvatar - changes', changes)
      if (callback) {
        ref.getUser(tokenObj.userid, params, callback)
      }
    })
  },
  // destructive to user
  // to database format
  apiToUser: function(user, callback) {
    // collapse API to db structure
    // copy what we can without linking to the orignal, so we don't destroy
    var userData=JSON.parse(JSON.stringify(user))
    if (user.username === undefined) {
      console.log('dispatcher::apiToUser - user', user.id, 'doesnt have a username', user)
      user.username = ''
    }
    userData.username=user.username.toLowerCase() // so we can find it
    userData.created_at=new Date(user.created_at) // fix incoming created_at iso date to Date
    // if there isn't counts probably a bad input
    if (user.counts) {
      userData.following=user.counts.following
      userData.followers=user.counts.followers
      userData.posts=user.counts.posts
      userData.stars=user.counts.stars
    }
    if (user.avatar_image === undefined) {
      console.log('dispatcher::apiToUser - user', user.id, 'doesnt have a avatar_image', user)
      user.avatar_image = {}
    }
    // set avatar to null if is_default true
    userData.avatar_width=user.avatar_image.width
    userData.avatar_height=user.avatar_image.height
    userData.avatar_image=user.avatar_image.url
    if (user.cover_image === undefined) {
      console.log('dispatcher::apiToUser - user', user.id, 'doesnt have a cover_image', user)
      user.cover_image = {}
    }
    userData.cover_width=user.cover_image.width
    userData.cover_height=user.cover_image.height
    userData.cover_image=user.cover_image.url

    if (user.description) {
      //console.log('user '+data.id+' has description', data.description.entities)
      if (user.description.entities) {
        //console.log('user '+data.id+' has entities')
        this.setEntities('user', user.id, user.description.entities, function(entities, err) {
          if (err) {
            console.log("entities Update err: "+err)
          //} else {
            //console.log("entities Updated")
          }
        })
      }
      // cache html version
      userData.descriptionhtml=user.description.html
      // since userData is a reference to data, we can't stomp on it until we're done
      userData.description=user.description.text
    }
    callback(userData, null)
    //return userData
  },
  // from internal database format
  userToAPI: function(user, token, callback, meta) {
    //console.log('dispatcher.js::userToAPI - '+user.id, callback, meta)
    if (!user) {
      callback(null, 'dispatcher.js::userToAPI - no user passed in')
      return
    }
    if (!callback) {
      callback(null, 'dispatcher.js::userToAPI - no callback passed in')
      return
    }
    //console.log('dispatcher.js::userToAPI - setting up res')
    //console.log('dispatcher.js::userToAPI - base user', user)
    //console.log('dispatcher.js::userToAPI - base avatar_image', user.avatar_image)
    // copy user structure
    var res={
      id: user.id,
      username: user.username,
      created_at: new Date(user.created_at),
      canonical_url: user.canonical_url,
      type: user.type,
      timezone: user.timezone,
      locale: user.locale,
      avatar_image: {
        url: user.avatar_image,
        width: user.avatar_width,
        height: user.avatar_height,
        is_default: user.avatar_image==''?true:false,
      },
      cover_image: {
        url: user.cover_image,
        width: user.cover_width,
        height: user.cover_height,
        is_default: user.cover_image==''?true:false,
      },
      counts: {
        following: user.following,
        posts: user.posts,
        followers: user.followers,
        stars: user.stars,
      }
    }
    if (user.description) {
      res.description={
        text: user.description,
        html: user.description,
        entities: {
          mentions: [],
          hashtags: [],
          links: []
        }
      }
    }
    // conditionals
    if (user.name) {
      res.name=user.name // 530 was cast as a int
    }
    if (user.verified_domain) {
      res.verified_domain=user.verified_domain
      // alpha needs this and the dev doesn't seem to cover it
      res.verified_link='http://'+user.verified_domain
    }

    if (user.description && !res.description) {
      console.log('dispatcher.js::userToAPI - sanity check failure...')
    }

    var need = {
      annotation: false,
      tokenFollow: false,
    }

    function needComplete(type) {
      need[type] = false
      // if something is not done
      //console.log('dispatcher.js::userToAPI - checking if done, just finished', type)
      for(var i in need) {
        if (need[i]) {
          if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') -', i, 'is not done')
          return
        }
      }
      // , res, meta
      if (user.debug) console.log('dispatcher.js::userToAPI ('+user.id+') - done')
      //console.log('dispatcher.js::userToAPI - done, text', data.text)
      // everything is done
      reallyDone()
      //callback(data, null, meta)
    }

    var ref=this
    function reallyDone() {
      // final peice
      if (user.description) {
        // use entity cache?
        if (1) {
          //console.log('dispatcher.js::userToAPI - getEntities '+user.id)
          ref.getEntities('user', user.id, function(userEntitiesErr, userEntities, userEntitiesMeta) {
            if (userEntities) {
              entitiesController.copyentities('mentions', userEntities.mentions, res.description)
              entitiesController.copyentities('hashtags', userEntities.hashtags, res.description)
              entitiesController.copyentities('links', userEntities.links, res.description)
            } else {
              console.error('no userEntities for user', user.id)
            }
            // use html cache?
            if (1) {
              if (res.description) {
                res.description.html=user.descriptionhtml
              } else {
                console.log('dispatcher.js::userToAPI - what happened to the description?!? ', user, res)
              }
              if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') - calling back')
              callback(res, userEntitiesErr)
            } else {
              // you can pass entities if you want...
              // text, entities, postcontext, callback
              ref.textProcess(user.description, users.entities, false, function(textProc, err) {
                res.description.html=textProc.html
                callback(res, userEntitiesErr)
              })
            }
          })
        } else {
          //console.log('dispatcher.js::userToAPI - textProcess description '+user.id)
          //console.log('dispatcher.js::userToAPI - calling back', res)
          ref.textProcess(user.description, user.entities, false, function(textProc, err) {
            res.description.html=textProc.html
            res.description.entities=textProc.entities
            callback(res, null)
          })
        }
      } else {
        //console.log('dispatcher.js::userToAPI - calling back', res)
        callback(res, null)
      }
    }

    if (user.annotations) {
      if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') - need user annotations')
      need.annotation = true
      var loadAnnotation=function(user, cb) {
        if (user.debug) console.log('dispatcher.js::userToAPI('+user.id+') - get user annotations')
        ref.getAnnotation('user', user.id, function(dbNotes, err, noteMeta) {
          if (user.debug) console.log('user', user.id, 'annotations', dbNotes.length)
          var apiNotes = []
          for(var j in dbNotes) {
            var note=dbNotes[j]
            //console.log('got note', j, '#', note.type, '/', note.value, 'for', user.id)
            apiNotes.push({
              type: note.type,
              value: note.value,
            })
          }
          cb(apiNotes, err, noteMeta)
        })
      }

      loadAnnotation(user, function(apiNotes, notesErr, notesMeta) {
        if (notesErr) console.log('dispatcher.js::userToAPI - loadAnnotation', notesErr)
        if (user.debug) console.log('final anno', apiNotes.length)
        res.annotations=apiNotes
        needComplete('annotation')
      })
      //res.annotations = user.annotations
    }

    if (token && token.userid) {
      need.tokenFollow = true
      //console.log('dispatcher.js::userToAPI - need tokenFollow')
      // follows_you
      // you_follow
      this.cache.follows(token.userid, user.id, function(err, following) {
        //console.log('do we follow this guy?', following, 'err', err)
        if (following && following.active) {
          //console.log('flagging as followed')
          res.you_follow=true
        }
        //reallyDone()
        needComplete('tokenFollow')
      })
    } else {
      //reallyDone()
      needComplete('tokenFollow')
    }
  },
  getUser: function(user, params, callback) {
    //console.log('dispatcher.js::getUser - '+user, params)
    if (!callback) {
      console.error('dispatcher.js::getUser - no callback passed in')
      callback(null, 'dispatcher.js::getUser - no callback passed in')
      return
    }
    if (!user) {
      callback(null, 'dispatcher.js::getUser - no getUser passed in')
      return
    }
    if (params===null) {
      console.log('dispatcher.js::getUser - params are null')
      params={
        generalParams: {},
        tokenobj: {}
      }
    }
    //console.log('dispatcher.js::getUser - params', params)
    var ref=this
    this.normalizeUserID(user, params.tokenobj, function(userid, err) {
      if (err) {
        console.log('dispatcher.js::getUser - cant normalize user', user, err)
      }
      // maybe just spare caminte all together and just callback now
      if (!userid) userid = 0 // don't break caminte
      ref.cache.getUser(userid, function(userErr, userobj, userMeta) {
        if (userErr) {
          console.log('dispatcher.js::getUser - cant get user', userid, userErr)
        }
        if (userobj && params.generalParams) {
          // FIXME: temp hack (until we can change the userToAPI prototype)
          userobj.annotations = params.generalParams.annotations || params.generalParams.user_annotations
        //} else {
          //console.log('dispatcher.js::getUser - not such user?', userid, 'or no generalParams?', params)
        }
        //console.log('found user', userobj.id, '==', user)
        if (!userobj) {
          console.error('dispatcher.js::getUser - no userobj', userobj)
          // this breaks token registration
          // userobj = {}
        }
        //if (params.debug) userobj.debug = true
        ref.userToAPI(userobj, params.tokenobj, callback, userMeta)
      })
    })
    /*
    if (user=='me') {
      //console.log('getUser token', params.tokenobj)
      if (params.tokenobj) {
        console.dir(params.tokenobj)
        this.cache.getUser(params.tokenobj.userid, function(userobj, userErr, userMeta) {
          //console.log('dispatcher.js::getUser - gotUser', userErr)
          ref.userToAPI(userobj, params.tokenobj, callback, userMeta)
        })
      } else {
        this.getUserClientByToken(params.token, function(usertoken, err) {
          if (usertoken==null) {
            console.log('dispatcher.js::getUser - me but not token')
            callback(null, 'dispatcher.js::getUser - me but not token')
            return
          } else {
            ref.cache.getUser(usertoken.userid, function(userobj, userErr, userMeta) {
              //console.log('dispatcher.js::getUser - gotUser', userErr)
              ref.userToAPI(userobj, params.token, callback, userMeta)
            })
          }
        })
      }
    } else {
      var func='getUser'
      // make sure we check the cache
      if (user[0]=='@') {
        func='getUserID'
        // strip @ from beginning
        user=user.substr(1)
      }
      //console.log('dispatcher.js::getUser - calling', func)
      this.cache[func](user, function(userobj, userErr, userMeta) {
        //console.log('dispatcher.js::getUser - gotUser', userErr)
        ref.userToAPI(userobj, params.tokenobj, callback, userMeta)
      })
    }
    */
  },
  // NOTE: users has to be an array!
  getUsers: function(users, params, callback) {
    //console.log('dispatcher.js::getUsers - '+user, params)
    if (!callback) {
      console.log('dispatcher.js::getUsers - no callback passed in')
      return
    }
    if (!users) {
      callback(null, 'dispatcher.js::getUsers - no getUser passed in')
      return
    }
    if (params===null) {
      console.log('dispatcher.js::getUsers - params are null')
      params={
        tokenobj: {}
      }
    }

    var ref=this
    /*
    this.cache.getUsers(users, params, function(userObjs, userErr, meta) {
      if (!userObjs.length) {
        callback([], null, meta)
        return
      }
      var rUsers=[]
      for(var i in userObjs) {
        ref.userToAPI(userObjs[i], params.tokenobj, function(adnUserObj, err) {
          //console.log('dispatcher.js::getUsers - got', adnUserObj, 'for', users[i])
          rUsers.push(adnUserObj)
          if (rUsers.length==users.length) {
            callback(rUsers, null, meta)
          }
        }, meta)
      }
    })
    */
    //console.log('dispatcher.js::getUsers - calling', func)
    var rUsers=[]
    //console.log('dispatcher.js::getUsers - users', users)
    for(var i in users) {
      //console.log('dispatcher.js::getUsers - user', users[i])
      this.normalizeUserID(users[i], params.tokenobj, function(userid, err) {
        ref.cache.getUser(userid, function(userErr, userobj, userMeta) {
          //console.log('dispatcher.js::getUsers - gotUser', userErr)

          if (userobj && params.generalParams) {
            // FIXME: temp hack (until we can change the userToAPI prototype)
            userobj.annotations = params.generalParams.annotations || params.generalParams.user_annotations
          //} else {
            //console.log('dispatcher.js::getUser - not such user?', userid, 'or no generalParams?', params)
          }

          ref.userToAPI(userobj, params.tokenobj, function(adnUserObj, err) {
            //console.log('dispatcher.js::getUsers - got', adnUserObj, 'for', users[i])
            rUsers.push(adnUserObj)
            if (rUsers.length==users.length) {
              callback(rUsers, '')
            }
          }, userMeta)
        })
      })
    }
  },
  userSearch: function(query, params, tokenObj, callback) {
    var ref=this
    this.cache.searchUsers(query, params, function(err, users, meta) {
      //console.log('dispatcher.js::userSearch - got', users.length, 'users')
      if (!users.length) {
        callback([], null, meta)
        return
      }
      var rUsers=[]
      for(var i in users) {
        ref.userToAPI(users[i], tokenObj, function(adnUserObj, err) {
          //console.log('dispatcher.js::userSearch - got', adnUserObj, 'for', users[i])
          rUsers.push(adnUserObj)
          if (rUsers.length==users.length) {
            //console.log('dispatcher.js::userSearch - final', rUsers)
            callback(rUsers, null, meta)
          }
        }, meta)
      }
    })
  },
}
