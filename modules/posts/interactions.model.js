var interactionModel

var applyParams

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  schemaData = modelOptions.schemaData
  // split up?
  // we don't need reposts here becauses have all that info with a repost_of column
  // since an entire post is created on repost
  // though repost could also write here in the future, making it easier to pull
  // stars are recorded only here
  /** interaction storage model */
  interactionModel = schemaData.define('interaction', {
    userid: { type: Number, index: true },
    type: { type: String, length: 8, index: true }, // star,unstar,repost,unrepost,delete
    datetime: { type: Date },
    idtype: { type: String, index: true }, // post (what about chnl,msg,user? not for existing types)
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
      //console.log('dataaccess.caminte.js::addStar - write me!')
      // nope
      //console.log('dataaccess.caminte.js::addStar - token: ', token) // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 0, Date.now())
      // we're supposed to return the post
      callback(false, false, false)
    }
  },
  delStar: function(postid, token, callback) {
    if (this.next) {
      this.next.delStar(postid, token, callback)
    } else {
      //console.log('dataaccess.caminte.js::delStar - write me!')
      //console.log('dataaccess.caminte.js::delStar - token: ', token) // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 1, Date.now())
      // we're supposed to return the post
      callback(false, false, false)
    }
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
    var ref=this
    var finishfunc=function(userid) {
      //console.log('caminte::getInteractions', type, params, user, '=>', userid)
      interactionModel.find({ where: { userid: userid, type: type, idtype: 'post' }, limit: params.count, order: "datetime DESC" }, function(err, interactions) {
        if (err) console.error('interactions.model.js::getInteractions - err', err)
        if (interactions==null && err==null) {
          // none found
          //console.log('dataaccess.caminte.js::getStars - check proxy?')
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
    if (user[0]=='@') {
      var username=user.substr(1)
      this.getUserID(username, function(err, userobj) {
        if (err) console.error('interactions.model.js::getInteractions - err', err)
        var id = false
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
      console.error('dataaccess.caminte.js::getChannelDeletions - no callback passed in')
      return
    }
    var query = interactionModel.find().where('userid', channel_id).where('type', 'delete').where('idtype', 'message')
    applyParams(query, params, callback)
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    // is there an existing match for this key (userid, postid, type)
    // wouldn't find or create be better here?
    var ref = this
    //console.log('caminte::setInteractions', userid, postid, type, metaid, deleted)
    interactionModel.find({ where: { userid: userid, typeid: postid, type: type } }, function(err, foundInteractions) {

      function doFinalCheck(err, interactions, meta) {
        var postDone=false
        var userDone=false
        function checkDone() {
          if (postDone && userDone) {
            if (callback) {
              callback(err, interactions, meta)
            }
          }
        }
        if (type==='star') {
          // update num_stars
          ref.updatePostCounts(postid, function() {
            postDone=true
            checkDone()
          })
          // update counts.stars
          ref.updateUserCounts(userid, function() {
            userDone=true
            checkDone()
          })
        } else {
          postDone=true
          userDone=true
          checkDone()
        }
      }
      // already set dude
      //console.log('caminte::setInteractions - find', foundInteractions)
      if (foundInteractions && foundInteractions.length) {
        //console.log('caminte::setInteractions - already in db')
        if (deleted) {
          // nuke it
          var done=0
          for(var i in foundInteractions) {
            foundInteractions[i].destroy(function (err) {
              done++
              if (done===foundInteractions.length) {
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
      //console.log('camintejs::setInteraction - type',type)
      if (type=='star') {
        // is this the src or trg?
        //console.log('setInteraction - userid',userid)
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
          notice = {}
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
      interaction = new interactionModel()
      interaction.userid   = userid
      interaction.type     = type
      interaction.datetime = ts
      interaction.idtype   = 'post'
      interaction.typeid   = postid
      interaction.asthisid = metaid
      //if (foundInteraction.id==null) {
      //console.log('camintejs::setInteraction - inserting', interactionModel)
      //db_insert(interaction, interactionModel, function(interactions, err, meta) {
      interactionModel.create(interaction, function(err) {
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
  getUserStarPost: function(userid, postid, callback) {
    // did this user star this post
    //, limit: params.count
    //console.log('camintejs::getUserStarPost', userid, postid)
    interactionModel.find({ where: { userid: userid, type: 'star', typeid: postid, idtype: 'post' } }, function(err, interactions) {
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
    interactionModel.find({ where: { type: 'star', typeid: postid, idtype: 'post' }, limit: params.count }, function(err, interactions) {
      /*
      if (interactions==null && err==null) {
        callback(interactions, err)
      } else {
        callback(interactions, err)
      }
      */
      callback(err, interactions)
    })
  },
}
