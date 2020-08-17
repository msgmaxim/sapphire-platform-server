let InteractionModel

let applyParams
let schemaData

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  schemaData = modelOptions.schemaData
  // split up?
  // we don't need reposts here becauses have all that info with a repost_of column
  // since an entire post is created on repost
  // though repost could also write here in the future, making it easier to pull
  // stars are recorded only here
  /** interaction storage model */
  InteractionModel = schemaData.define('interaction', {
    userid: { type: Number, index: true },
    type: { type: String, length: 8, index: true }, // star,unstar,repost,unrepost,delete
    datetime: { type: Date },
    idtype: { type: String, index: true }, // post,message (what about chnl,msg,user? not for existing types)
    typeid: { type: Number, index: true }, // causing problems?
    asthisid: { type: Number } // meta.id
  })
}

module.exports = {
  next: false,
  start: start,
  /** Star/Interactions */
  addStar: function(postid, token, callback) {
    if (this.next) {
      this.next.addStar(postid, token, callback)
    } else {
      // nope
      //console.log('interactions.model.js::addStar - token: ', token) // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 0, Date.now())
      // we're supposed to return the post
      if (callback) callback(null, false, false)
    }
  },
  delStar: function(postid, token, callback) {
    if (this.next) {
      this.next.delStar(postid, token, callback)
    } else {
      //console.log('interactions.model.js::delStar - token: ', token) // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 1, Date.now())
      // we're supposed to return the post
      if (callback) callback(null, false, false)
    }
  },
  // FIXME: include when to use notice
  // and when to use interaction
  // we hacked togehter a deletion system with this...
  // out of adn spec
  addInteraction: function(type, targetid, idtype, typeid, callback) {
    const interaction = new InteractionModel()
    interaction.userid   = parseInt(targetid)
    interaction.type     = type
    interaction.datetime = Date.now()
    interaction.idtype   = idtype
    interaction.typeid   = parseInt(typeid)
    interaction.save(function(err) {
      if (err) console.error('interactions.model.js::addInteraction - err', err)
      if (callback) callback(err, interaction)
    })
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    // is there an existing match for this key (userid, postid, type)
    // wouldn't find or create be better here?
    const ref = this
    //console.log('interactions.model.js::setInteractions', userid, postid, type, metaid, deleted)
    InteractionModel.find({ where: { userid: userid, typeid: postid, type: type } }, function(err, foundInteractions) {
      if (err) console.error('interactions.model.js::setInteraction - find err', err)
      function doFinalCheck(err, interactions, meta) {
        if (err) console.error('interactions.model.js::setInteraction - doFinalCheck err', err)

        let postDone = false
        let userDone = false
        function checkDone() {
          if (postDone && userDone) {
            if (callback) {
              callback(err, interactions, meta)
            }
          }
        }
        if (type === 'star') {
          // update num_stars
          ref.updatePostCounts(postid, function() {
            postDone = true
            checkDone()
          })
          // update counts.stars
          ref.updateUserCounts(userid, function() {
            userDone = true
            checkDone()
          })
        } else {
          postDone = true
          userDone = true
          checkDone()
        }
      }
      // already set dude
      //console.log('interactions.model.js::setInteractions - find', foundInteractions)
      if (foundInteractions && foundInteractions.length) {
        //console.log('interactions.model.js::setInteractions - already in db')
        if (deleted) {
          // nuke it
          let done = 0
          for (const i in foundInteractions) {
            foundInteractions[i].destroy(function(err) {
              done++
              if (done === foundInteractions.length) {
                // hiding all errors previous to last one
                doFinalCheck('', err)
              }
            })
          }
        } else {
          doFinalCheck(false, false, false)
        }
        return
      }

      // ok star,repost
      //console.log('interactions.model.js::setInteraction - type',type)
      if (type === 'star') {
        // is this the src or trg?
        //console.log('interactions.model.js::setInteraction - userid',userid)
        // do notify
        // could guard but then we'd need more indexes
        // i think we'll be ok if we don't guard for now
        //noticeModel.noticeModel( { where: { created_at: ts, type: type } }, function(err, notify)

        // first who's object did we interact with
        ref.getPost(postid, function(err, post, meta) {
          if (err) {
            console.error('star getPost', postid, 'err', err)
          }
          if (!post) {
            console.warn('no post for', postid)
            return
          }
          const notice = {}
          notice.event_date   = ts
          // owner of post should be notified
          notice.notifyuserid = post.userid // who should be notified
          notice.actionuserid = userid // who took an action
          notice.type         = type // star,repost,reply,follow
          notice.typeid       = postid // postid(star,respot,reply),userid(follow)
          //notice.asthisid   = metaid
          ref.addNotice(notice)
          //db_insert(notice, noticeModel, function() { })
        })
      }

      // is this new action newer
      const interaction = new InteractionModel()
      interaction.userid   = userid
      interaction.type     = type
      interaction.datetime = ts
      interaction.idtype   = 'post'
      interaction.typeid   = postid
      interaction.asthisid = metaid
      //if (foundInteraction.id==null) {
      //console.log('interactions.model.js::setInteraction - inserting', InteractionModel)
      //db_insert(interaction, InteractionModel, function(interactions, err, meta) {
      InteractionModel.create(interaction, function(err) {
        doFinalCheck(err, interaction, false)
      })
      /*
      } else {
        console.log('setInteraction found dupe', foundInteraction, interaction)
        if (callback) {
          callback('', 'duplicate')
        }
      }
      */
    })
  },
  // USERS DONT INTERACT WITH EACH OTHER (except follows)
  // THEY (mostly) INTERACT WITH POSTS
  // and we'll need to deference the post.user as a user can have 10k posts
  // and we need to be able to query by user without looking up 10k and joining that set
  //
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  //
  // this isn't good enough
  // we will rarely query by user
  // idtype and type are highly likely
  // can be in context of token/user
  getInteractions: function(type, user, params, callback) {
    //console.log('Getting '+type+' for '+userid)
    const ref = this
    const finishfunc = function(userid) {
      //console.log('interactions.model.js::getInteractions', type, params, user, '=>', userid)
      InteractionModel.find({ where: { userid: userid, type: type, idtype: 'post' }, limit: params.count, order: 'datetime DESC' }, function(err, interactions) {
        if (err) console.error('interactions.model.js::getInteractions - err', err)
        if (interactions === null && err === null) {
          // none found
          //console.log('interactions.model.js::getStars - check proxy?')
          // user.stars_updated vs appstream start
          // if updated>appstream start, we can assume it's up to date
          if (ref.next) {
            ref.next.getInteractions(type, userid, params, callback)
            return
          }
        }
        //console.dir(interactions)
        callback(err, interactions)
      })
    }
    if (user[0] === '@') {
      const username = user.substr(1)
      this.getUserID(username, function(err, userobj) {
        if (err) console.error('interactions.model.js::getInteractions - err', err)
        let id = false
        if (userobj) {
          id = userobj.id
        }
        finishfunc(id)
      })
    } else {
      finishfunc(user)
    }
  },
  getChannelDeletions: function(channel_id, params, callback) {
    //console.log('dataaccess.caminte.js::getChannelDeletions - ', channel_id)
    if (callback === undefined) {
      console.trace('interactions.model.js::getChannelDeletions - no callback passed in')
      return
    }
    const query = InteractionModel.find().where('userid', channel_id).where('type', 'delete').where('idtype', 'message')
    applyParams(query, params, callback)
  },
  getUserStarPost: function(userid, postid, callback) {
    if (callback === undefined) {
      console.trace('interactions.model.js::getUserStarPost - no callback passed in')
      return
    }
    // did this user star this post
    //, limit: params.count
    //console.log('camintejs::getUserStarPost', userid, postid)
    InteractionModel.find({ where: { userid: userid, type: 'star', typeid: postid, idtype: 'post' } }, function(err, interactions) {
      callback(err, interactions[0])
    })
  },
  // get a list of posts starred by this user (Retrieve Posts starred by a User)
  // https://api.app.net/users/{user_id}/stars
  // getUserStarPosts
  //
  // get a list of users that have starred this post
  // getPostStars
  getPostStars: function(postid, params, callback) {
    if (callback === undefined) {
      console.trace('interactions.model.js::getPostStars - no callback passed in')
      return
    }
    InteractionModel.find({ where: { type: 'star', typeid: postid, idtype: 'post' }, limit: params.count }, callback)
  }
}
