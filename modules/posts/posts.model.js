var postModel

var applyParams

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  schemaData = modelOptions.schemaData
  // this data needs to not use internal Pks
  // I'd like to be able to copy random tables from one server to another
  // to help bootstrap caches
  /** post storage model
   * @constructs postModel
   */
  postModel = schemaData.define('post',
    /** @lends postModel */
    {
    /** id of user */
    userid: { type: Number, index: true },
    /** text of post */
    text: { type: schemaData.Text },
    /** html of post */
    html: { type: schemaData.Text }, /* cache */
    /** post flagged as machine_only
     * @type boolean */
    machine_only: { type: Boolean, default: false, index: true },
    /** id of post that it's a reply to
     * @type {postid} */
    reply_to: { type: Number }, // kind of want to index this
    /** root id of post all replies are children of
     * @type {postid} */
    thread_id: { type: Number, index: true },
    /** post flagged as deleted
     * @type boolean */
    is_deleted: { type: Boolean, default: false, index: true },
    /** date/time post was created at
     * @type Date */
    created_at: { type: Date },
    /** apparently we're string the client_id string here, may want an id here in the future */
    client_id: { type: String, length: 32, index: true },
    /** id of post it is a repost of
     * @type {postid} */
    repost_of: { type: Number, default: 0, index: true },
    /** posts.app.net url */
    canonical_url: { type: String },
    /** num of replies */
    num_replies: { type: Number, default: 0 },
    /** num of reposts */
    num_reposts: { type: Number, default: 0 },
    /** num of stars */
    num_stars: { type: Number, default: 0 }
  })
}

module.exports = {
  next: null,
  start: start,
  /**
   * posts
   */
  // doesn't require an id
  // tokenObj isn't really used at this point...
  // required fields: userid, clientid, text
  addPost: function(ipost, tokenObj, callback) {
    // if we local commit, do we also want to relay it upstream?
    if (this.next) {
      this.next.addPost(ipost, tokenObj, callback)
    } else {
      var ref=this
      if (ipost.text===undefined) {
        console.log('camintejs::addPost - no text', ipost)
        callback(null, 'no_text', null)
        return
      }
      /*
      if (ipost.html===undefined) {
        console.log('camintejs::addPost - no html', ipost)
        callback(null, 'no_html', null)
        return
      }
      */
      // if no next, then likely no upstream
      //console.log('camintejs::addPost - token', tokenObj)
      //console.log('camintejs::addPost - ipost', ipost)
      // need to deal with clientid stuffs
      // can't put in dispatcher because it shouldn't have to detect my next..
      // well it could...
      //this.getLocalClient(client_id, function(client, err) {
      ipost.created_at=new Date()
      if (!ipost.html) {
        ipost.html=ipost.text
      }
      // final step
      function doCB(err, rec) {
        // addRepost does call addPost
        if (ipost.repost_of && ipost.userid) {
          // look up the parent post
          ref.getPost(ipost.repost_of, function(err, post) {
            //console.log('addPost - trying to create a repost notice', post)
            var notice = {}
            notice.event_date = ipost.created_at
            notice.notifyuserid = post.userid // who should be notified
            notice.actionuserid = ipost.userid // who took an action
            notice.type = 'repost' // star,repost,reply,follow
            notice.typeid = rec.id // postid(star,respot,reply),userid(follow)
            ref.addNotice(notice)
            //db_insert(notice, noticeModel)
          })
        }

        if (ipost.thread_id) {
          ref.updatePostCounts(ipost.thread_id)
        }
        // can support a cb but we don't need one atm
        ref.updateUserCounts(ipost.userid)
        if (ipost.reply_to) {
          // look up the parent post
          ref.getPost(ipost.reply_to, function(err, post) {
            //console.log('addPost - trying to create a reply notice', post)
            //notice=new noticeModel()
            var notice = {}
            notice.event_date = ipost.created_at
            notice.notifyuserid = post.userid // who should be notified
            notice.actionuserid = ipost.userid // // who took an action
            notice.type = 'reply' // star,repost,reply,follow
            // riposte is showing the original post
            // would be nice to include the ipost.reply_to somewhere
            notice.typeid = rec.id // postid(star,respot,reply),userid(follow)
            notice.altnum = post.id
            //db_insert(notice, noticeModel)
            ref.addNotice(notice)
          })
          if (ipost.reply_to!=ipost.thread_id) { // optimization to avoid this twice
            ref.updatePostCounts(ipost.reply_to)
          }
        }
        if (callback) {
          callback(err, rec)
        }
      }
      // network client_id
      // but since there's no uplink
      // our local is the network tbh
      // already done in dialect
      //ipost.client_id=tokenObj.client_id
      //console.log('camintejs::addPost - insert post', ipost)
      var rec = new postModel(ipost)
      //rec.save(function(err) {
      postModel.create(rec, function(err) {
      //db_insert(new postModel(ipost), postModel, function(rec, err) {
        //console.log('camintejs::addPost - res', rec)
        if (err) {
          console.error('camintejs::addPost - insert err', err)
        }
        // get id
        if (rec.id) {
          //console.log('have id')
          var saveit = 0
          if (!rec.thread_id) {
            rec.thread_id = rec.id
            saveit = 1
          }
          if (rec.text.match(/{post_id}/)) {
            rec.text = rec.text.replace(new RegExp('{post_id}', 'g'), rec.id)
            saveit = 1
          }
          // we dont need to even bother, this field needs to be nuked
          if (rec.html.match(/{post_id}/)) {
            // needs to be reparsed tbh
            // hack
            // doesn't really matter, the entities need to be redone too
            // yea alpha reads txt and entities
            //rec.html=rec.html.replace(new RegExp('https://photo.app.net/">https://photo.app.net/</a>{post_id}/1', 'g'),
            //  'https://photo.app.net/'+rec.id+'/1">https://photo.app.net/'+rec.id+'/1</a>')
            // proper
            // so textProcess is in dispatcher and we can't access it...
            // we'll just filter and trigger above
            rec.html=rec.html.replace(new RegExp('{post_id}', 'g'), rec.id)
            saveit=1
          }
          //console.log('text', rec.text)
          //console.log('html', rec.html)
          //console.log('saveit', saveit)
          if (saveit) {
            rec.save(function() {
              // new thread or {post_id}
              //console.log('camintejs::addPost - rewrote, final', rec)
              doCB(err, rec)
            })
          } else {
            //console.log('camintejs::addPost - success, final', rec)
            doCB(err, rec)
          }
        } else {
          //console.log('camintejs::addPost - non success, final', rec)
          // set thread_id
          doCB(err, rec)
        }
      })
      //})
    }
  },
  delPost: function(postid, callback) {
    var ref = this
    postModel.findById(postid, function(err, post) {
      if (err) {
        var meta={
          code: 500
        }
        callback(post, err, meta)
        return
      }
      post.is_deleted = 1
      post.save(function(err2) {
        var meta={
          code: 200
        }
        //console.log('camintejs::delPost - cleaning reposts of', postid)
        // now we have to mark any reposts as deleted
        postModel.update({ where: { repost_of: postid } },
        { is_deleted: 1 }, function(repostErr, udpateRes) {
          //console.log('camintejs::delPost - postModel.update returned', updateRes)
          ref.updatePostCounts(postid, function() {
            callback(err2, post, meta)
          })
        })
      })
    })
  },
  updatePostHTML: function(postid, html, callback) {
    postModel.findById(postid, function(err, post) {
      post.html=html
      post.save(function(err) {
        if (callback) {
          callback(err, post)
        }
      })
    })
  },
  updatePostCounts: function(postid, callback) {
    if (postid === undefined) {
      console.error('updatePostCounts postid is undefined')
      if (callback) {
        callback('postid undefined', false, false)
      }
      return
    }
    //console.log('camintejs::updatePostCounts - for', postid)
    var ref=this
    // get a handle on the post we want to modify
    postModel.findById(postid, function(err, post) {
      if (err) {
        console.error('updatePostCounts getPost get', postid, err)
      }
      // num_replies, num_stars, num_reposts
      // getReplies: function(postid, params, token, callback) {
      ref.getReplies(postid, {}, {}, function(err, replies, meta) {
        if (err) console.error('updatePostCounts - replies err:', err)
        if (!replies) replies=[]
        //console.log('camintejs::updatePostCounts - ', replies.length, 'replies for', postid)
        // not currently returning the original
        post.num_replies=replies.length ? replies.length : 0 // -1 for the original which is included in replies
        post.save()
      })
      // getPostStars: function(postid, params, callback) {
      ref.getPostStars(postid, {}, function(err, interactions, meta) {
        if (err) console.error('updatePostCounts - stars err:', err)
        if (!interactions) interactions=[]
        post.num_stars=interactions.length
        post.save()
      })
      //getReposts: function(postid, params, token, callback) {
      ref.getReposts(postid, {}, {}, function(err, posts, meta) {
        if (err) console.error('updatePostCounts - reposts err:', err)
        if (!posts) posts=[]
        //console.log('camintejs::updatePostCounts - ', posts.length, 'reposts for', postid)
        post.num_reposts=posts.length
        post.save()
      })
    })
    // tight up later
    if (callback) {
      // FIXME return with correct counts
      callback()
    }
  },
  // requires that we have an id
  setPost: function(ipost, callback) {
    /*
    delete ipost.source
    delete ipost.user
    delete ipost.annotations
    delete ipost.entities
    */
    if (!ipost) {
      console.log('caminte::setPost - no post passed')
      if (callback) {
        callback(null, 'no post')
      }
      return
    }
    if (ipost.repost_of && ipost.userid) {
      // look up the parent post
      this.getPost(ipost.repost_of, function(err, post) {
        // console.log('setPost - trying to create a repost notice')
        notice=new noticeModel()
        notice.event_date=ipost.created_at
        notice.notifyuserid=post.userid // who should be notified
        notice.actionuserid=ipost.userid // who took an action
        notice.type='repost' // star,repost,reply,follow
        notice.typeid=ipost.id // postid(star,respot,reply),userid(follow)
        //db_insert(notice, noticeModel)
        notice.save()
      })
    }
    if (ipost.reply_to) {
      // look up the parent post
      this.getPost(ipost.reply_to, function(err, post) {
        // console.log('setPost - trying to create a reply notice')
        notice=new noticeModel()
        notice.event_date=ipost.created_at
        notice.notifyuserid=post.userid // who should be notified
        notice.actionuserid=ipost.userid // // who took an action
        notice.type='reply' // star,repost,reply,follow
        // riposte is showing the original post
        notice.typeid=ipost.id // postid(star,respot,reply),userid(follow)
        notice.altnum = post.id
        //db_insert(notice, noticeModel)
        notice.save()
      })
    }
    var ref=this
    // oh these suck the worst!
    postModel.findOrCreate({
      id: ipost.id
    }, ipost, function(err, post) {
      if (ipost.thread_id) {
        ref.updatePostCounts(ipost.thread_id)
      }
      if (ipost.reply_to) {
        if (ipost.reply_to!=ipost.thread_id) { // optimization to avoid this twice
          ref.updatePostCounts(ipost.reply_to)
        }
      }
      if (callback) {
        callback(post, err)
      }
    })
    //db_insert(new postModel(ipost), postModel, callback)
    // maybe call to check garbage collection?
  },
  addRepost: function(postid, originalPost, tokenObj, callback) {
    if (this.next) {
      this.next.addRepost(postid, originalPost, token, callback)
    } else {
      //console.log('dataaccess.camintejs.js::addRepost - write me!')
      // we need to add a post stub
      var ipost={
        text: '',
        userid: tokenObj.userid,
        client_id: tokenObj.client_id,
        thread_id: originalPost,
        // adn spec says reposts cannot be reposted
        repost_of: postid
      }
      //console.log('dataaccess.camintejs.js::addRepost - ', ipost)
      // then return post
      this.addPost(ipost, tokenObj, callback)
    }
  },
  delRepost: function(postid, token, callback) {
    if (this.next) {
      this.next.delRepost(postid, token, callback)
    } else {
      // just delete the post
      // FIXME: security check
      this.delPost(postid, callback)
    }
  },
  getPost: function(id, callback) {
    //console.log('dataaccess.caminte.js::getPost - id', id)
    if (id === undefined) {
      callback('dataaccess.caminte.js::getPost - id is undefined', false, false)
      return
    }
    var ref=this
    postModel.findById(id, function(err, post) {
      //console.log('dataaccess.caminte.js::getPost - post, err',post,err)
      if (err) {
        console.error('dataaccess.caminte.js::getPost - post, err', post, err)
      }
      if (post==null && err==null) {
        //console.log('dataaccess.caminte.js::getPost - next?',ref.next)
        if (ref.next) {
          //console.log('dataaccess.caminte.js::getPost - next')
          ref.next.getPost(id, callback)
          return
        }
      }
      callback(err, post, false)
    })
  },
  // why do we need token here? we don't need it
  getReposts: function(postid, params, token, callback) {
    //console.log('dataaccess.caminte.js::getReposts - postid', postid)
    var ref=this
    // needs to also to see if we definitely don't have any
    // FIXME: is_deleted optional
    postModel.find({ where: { repost_of: postid, is_deleted: false } }, function(err, posts) {
      if (err) {
        console.log('dataaccess.caminte.js::getReposts - err', err)
      }
      //console.log('dataaccess.caminte.js::getReposts - null', posts==null, posts)
      // what if it just doesn't have any, how do we store that?
      if ((posts==null || posts.length==0) && err==null) {
        // before we hit proxy, check empties
        // if there is one, there should only ever be one
        // uhm shit changes
        //emptyModel.findOne({ where: { type: 'repost', typeid: postid } }, function(err, empties) {
        ref.findEmpty('repost', postid, function(err, empties) {
          //console.log('dataaccess.caminte.js::getPost - empties got',empties)
          if (empties===null) {
            // if empties turns up not set
            if (ref.next) {
              //console.log('dataaccess.caminte.js::getPost - next')
              ref.next.getReposts(postid, params, token, function(pdata, err, meta) {
                // set empties
                //console.log('dataaccess.caminte.js::getPost - proxy.getReposts got',pdata)
                if (pdata.length==0) {
                  // no reposts
                  //console.log('dataaccess.caminte.js::getPost - proxy.getReposts got none')
                  // createOrUpdate? upsert?
                  var empty={}
                  empty.type='repost'
                  empty.typeid=postid
                  // .getTime()
                  empty.last_updated=new Date()
                  //db_insert(empty, emptyModel)
                  ref.addEmpty(empty)
                }
                callback(err, pdata, meta)
              })
              return
            } else {
              // no way to get data
              callback(false, false, false)
            }
          } else {
            //console.log('dataaccess.caminte.js::getPost - used empty cache')
            // we know it's empty
            callback(false, [])
          }
        })
      } else {
        //console.log('dataaccess.caminte.js::getReposts - reposts count:', posts.length)
        callback(err, posts)
      }
    })
  },
  getUserRepostPost: function(userid, thread_id, callback) {
    // did we repost any version of this repost
    //console.log('camintejs::getUserRepostPost - userid', userid, 'repost_of', repost_of)
    postModel.findOne({ where: { userid: userid, thread_id: thread_id, repost_of: { ne: 0 }, is_deleted: false } }, function(err, post) {
      //console.log('camintejs::getUserRepostPost - ', userid, postid, posts)
      callback(err, post)
    })
  },
  // why do we need token?
  getReplies: function(postid, params, token, callback) {
    //console.log('dataaccess.caminte.js::getReplies - id is '+postid)
    var ref=this
    // thread_id or reply_to?

    //, id: { ne: postid }
    // applyParams should handle the is_deleted
    var query = postModel.find().where('thread_id', postid).where('repost_of', 0)

    function finishGetReplies() {
      applyParams(query, params, function(err, posts, meta) {
      //postModel.find({ where: { thread_id: postid, repost_of: { ne: postid } }, limit: params.count, order: "id DESC" }, function(err, posts) {
        //console.log('found '+posts.length,'err',err)
        if ((posts==null || posts.length==0) && err==null) {
          // before we hit proxy, check empties
          // if there is one, there should only ever be one
          //emptyModel.findOne({ where: { type: 'replies', typeid: postid } }, function(err, empties) {
          ref.findEmpty('replies', postid, function(err, empties) {
            //console.log('dataaccess.caminte.js::getReplies - empties got',empties)
            if (empties!==null) {
              console.log('dataaccess.caminte.js::getReplies - used empty cache')
              // we know it's empty
              return callback(false, [], meta)
            }
            if (ref.next) {
              //console.log('dataaccess.caminte.js::getReplies - next')
              ref.next.getReplies(postid, params, token, function(err, pdata, meta) {
                // set empties
                console.log('dataaccess.caminte.js::getReplies - proxy.getReposts got length',pdata.length,'postid',postid)
                // 0 or the original post
                if (pdata.length<2) {
                  // no reposts
                  console.log('dataaccess.caminte.js::getReplies - proxy.getReposts got none')
                  // createOrUpdate? upsert?
                  var empty={}
                  empty.type='replies'
                  empty.typeid=postid
                  // .getTime()
                  empty.last_updated=new Date()
                  //db_insert(empty, emptyModel)
                  ref.addEmpty(empty)
                }
                callback(err, pdata, meta)
              })
              return
            }
            // no way to get data
            callback(false, false, false)
          })
        } else {
          callback(err, posts, meta)
        }
      })
    }
    if (params.tokenobj) {
      var mutedUserIDs = []
      //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
      this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
        for(var i in mutes) {
          mutedUserIDs.push(mutes[i].muteeid)
        }
        query=query.where('userid', { nin: mutedUserIDs })
        //console.log('getChannelMessages - params', params)
        finishGetReplies()
      })
    } else {
      finishGetReplies()
    }
  },
  getUserPostStream: function(userid, params, token, callback) {
    var ref=this
    //var finalfunc=function(userid) {
      // get a list of followings
    this.getAllFollowing(userid, function(err, follows) {
    //followModel.find({ where: { active: 1, userid: userid } }, function(err, follows) {
      //console.log('dataaccess.caminte.js::getUserStream - got '+follows.length+' for user '+user, 'follows', follows)
      /*
      if (err==null && follows!=null && follows.length==0) {
        //console.log('User follows no one?')
        if (ref.next) {
          //console.log('check upstream')
          ref.next.getUserStream(user, params, token, callback)
          return
        }
        callback([], null)
      } else {
      */
        // we have some followings
        // for each following
        var userids=[userid]
        for(var i in follows) {
          // follow.followsid
          userids.push(follows[i].followsid)
        }

        // get a list of their posts
        //console.log('dataaccess.caminte.js::getUserStream - getting posts for '+userids.length+' users')
        // could use this to proxy missing posts
        // what about since_id??

        // get a list of our reposts (OPTIMIZE ME: not dependent on followings)
        var query = postModel.find().where('userid', userid).where('repost_of', { ne: 0 })
        // in the range we're looking at
        if (params.pageParams) {
          // should speed this up
          if (params.pageParams.since_id) {
            query=query.gt('id', params.pageParams.since_id)
          }
          // probably not that important here
          if (params.pageParams.before_id) {
            // if not before end
            if (params.pageParams.before_id!=-1) {
              query=query.lt('id', params.pageParams.before_id)
            }
          }
        }
        //postModel.find({ where: { userid: userid, repost_of: { ne: '0' } } }, function(err, ourReposts) {
        query.run({}, function(err, ourReposts) {
          var removePosts=[]
          for(var i in ourReposts) {
            removePosts.push(ourReposts[i].id)
          }
          var maxid=0
          /*
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            if (posts.length) {
              maxid=posts[0].id
            }
            */
            //console.log('our reposts', ourRepostIds)
            // make sure all reposts are only show once?
            //
            // get a list of reposts in this criteria
            // check the thread_id for original to get user id
            // or
            // for everyone we following, get a list of their posts (that are reposted: num_reposts)
            // and exclude those reposts
            // well a repost can be of a repost
            // can either single out thread_id or recurse on reposts
            // thread_id in notRepostsOf and repost_of=0
            //
            // maybe we could get a list of repost_of values in page'd range...
            postModel.find({ where: { userid: { in: userids }, repost_of: 0, num_reposts: { gt: 0 } } }, function(err, theirPostsThatHaveBeenReposted) {
              var notRepostsOf=[]
              for(var i in theirPostsThatHaveBeenReposted) {
                notRepostsOf.push(theirPostsThatHaveBeenReposted[i].id)
              }
              query = postModel.find().where('id', { nin: removePosts }).where('repost_of', { nin: notRepostsOf }).where('userid',{ in: userids })
              if (params.tokenobj) {
                var mutedUserIDs = []
                //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
                this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
                  for(var i in mutes) {
                    mutedUserIDs.push(mutes[i].muteeid)
                  }
                  query=query.where('userid', { nin: mutedUserIDs })
                  //console.log('getChannelMessages - params', params)
                  applyParams(query, params, callback)
                })
              } else {
                applyParams(query, params, callback)
              }

              // get a list of posts where their reposts of reposts
              //postModel.find({ where: { thread_id: { in: notRepostsOf }, repost_of: { ne: 0  } } }, function(err, repostsOfRepostsOfFollowingPosts) {
              //console.log('notRepostsOf', notRepostsOf)
              //applyParams(query, params, maxid, callback)
              //})
            })
          //})
        })
        /*
        postModel.find({ where: { userid: { in: userids } }, order: 'created_at DESC', limit: params.count, offset: params.before_id }, function(err, posts) {
          if (err) {
            console.log('dataaccess.caminte.js::getUserStream - post find err',err)
            callback([], err)
          } else {
            console.log('dataaccess.caminte.js::getUserStream - Found '+posts.length+' posts',err)
            callback(posts, null)
          }
        })
        */
      //}
    })
    /*
    }
    if (user=='me') {
      this.getAPIUserToken(token, function(tokenobj, err) {
        finalfunc(tokenobj.userid)
      })
    } else if (user[0]=='@') {
      // uhm I don't think posts has a username field...
      this.getUserID(user.substr(1), function(userobj, err) {
        finalfunc(userobj.id)
      })
    } else {
      finalfunc(user)
    }
    */
  },
  // we don't need token
  getUnifiedStream: function(userid, params, callback) {
    var ref=this
    // get a list of followers
    //followModel.find({ where: { active: 1, userid: userid } }, function(err, follows) {
    this.getAllFollowing(userid, function(err, follows) {
      if (err) console.error('posts.model.js::getUnifiedStream - getAllFollowing err', err)
      //console.log('dataaccess.caminte.js::getUserStream - got '+follows.length+' for user '+userid)
      if (err==null && follows!=null && follows.length==0) {
        //console.log('User follows no one?')
        if (ref.next) {
          //console.log('check upstream')
          ref.next.getUserStream(userid, params, token, callback)
          return
        }
        callback(false, [])
      } else {
        // we have some followings
        // for each follower
        var userids=[]
        for(var i in follows) {
          // follow.followsid
          userids.push(follows[i].followsid)
        }
        // get list of mention posts
        var postids=[]
        entityModel.find().where('idtype', 'post').where('type', 'mention').where('alt', userid).run({}, function(err, entities) {
          console.log('dataaccess.caminte.js::getUnifiedStream - user', userid, 'has', entities.length, 'mentions')
          for(var i in entities) {
            postids.push(entities[i].typeid)
          }
          // get a list of posts in my stream
          postModel.find({ where: { userid: { in: userids } } }, function(err, posts) {
            console.log('dataaccess.caminte.js::getUnifiedStream - user', userid, 'has', posts.length, 'posts')
            for(var i in posts) {
              postids.push(posts[i].id)
            }

            // call back with paging
            var query = postModel.find().where('id', { in: postids} )
            if (params.tokenobj) {
              var mutedUserIDs = []
              //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
              this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
                for(var i in mutes) {
                  mutedUserIDs.push(mutes[i].muteeid)
                }
                query=query.where('userid', { nin: mutedUserIDs })
                //console.log('getChannelMessages - params', params)
                applyParams(query, params, callback)
              })
            } else {
              applyParams(query, params, callback)
            }
            //applyParams(query, params, callback)
          })
        })
        //console.log('dataaccess.caminte.js::getUnifiedStream - write me, mention posts')
        // get the list of posts from followings and mentions
        //console.log('dataaccess.caminte.js::getUserStream - getting posts for '+userids.length+' users')
        // could use this to proxy missing posts
        /*
        postModel.find({ where: { userid: { in: userids } }, order: 'created_at DESC', limit: 20 }, function(err, posts) {
          if (err) {
            console.log('dataaccess.caminte.js::getUnifiedStream - post find err',err)
            callback([], err)
          } else {
            //console.log('Found '+posts.length+' posts',err)
            callback(posts, null)
          }
        })
        */
        //applyParams(postModel.find().where('userid', { in: userids} ), params, callback)
      }
    })
  },
  getUserPosts: function(userid, params, callback) {
    //console.log('dataaccess.caminte.js::getUserPosts - start')
    var ref=this

    //applyParams(query, params, callback)
    //.where('active', 1)
    var query=postModel.find().where('userid', userid)
    applyParams(query, params, function(posts, err, meta) {
      if (err==null && (posts==null || !posts.length)) {
        if (ref.next) {
          ref.next.getUserPosts(user, params, callback)
          return
        }
      }
      callback(posts, err, meta)
    })

    /*
    // params.generalParams.deleted <= defaults to true
    var maxid=0
    // get the highest post id in posts
    postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
      //console.log('dataaccess.caminte.js::getUserPosts - back',posts)
      if (posts.length) {
        maxid=posts[0].id
      }
      console.log('dataaccess.caminte.js::getUserPosts - max', maxid)
      // .where('is_deleted', 0) set params doesn't need this
      applyParams(postModel.find().where('userid', userid), params, maxid, function(posts, err, meta) {
      })
    })
    */
  },
  getAllMutedPosts: function(userid, callback) {
    var mutedUserIDs = []
    //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
    this.getAllMutesForUser(userid, function(err, mutes) {
      for(var i in mutes) {
        mutedUserIDs.push(mutes[i].muteeid)
      }
      postModel.find({ where: { 'userid': { in: mutedUserIDs } } }, function(err, posts) {
        var mutedPostIDs = []
        for(var i in posts) {
          mutedPostIDs.push(posts[i].id)
        }
        callback(false, mutedPostIDs)
      })
    })
  },
  getGlobal: function(params, callback) {
    var ref=this
    //console.dir(params)
    // make sure count is positive
    //var count=Math.abs(params.count)
    var maxid=null
    //postModel.find().order('id', 'DESC').limit(1).run({},function(err, posts) {
    //postModel.all({ order: 'id DESC', limit: 1 }, function(err, posts) {
      //console.log('getGlobal - posts',posts)
      //if (posts.length) {
        //maxid=posts[0].id
        //console.log('getGlobal - maxid becomes',maxid)
      //}
      // filtering out reposts
      // but we may want them if time delayed
      // we just don't want a bunch of reposts in the same 20...
      // that's going to take some serious logic
      var query = postModel.all()
      //query.debug = true
      if (params.tokenobj) {
        var mutedUserIDs = []
        //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
        this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
          for(var i in mutes) {
            mutedUserIDs.push(mutes[i].muteeid)
          }
          query=query.where('userid', { nin: mutedUserIDs })
          //console.log('dataaccess.caminte::getGlobal - mutedUserIDs', mutedUserIDs)
          //console.log('getChannelMessages - params', params)
          applyParams(query, params, callback)
        })
      } else {
        applyParams(query, params, callback)
      }
      //applyParams(query, params, maxid, callback)
      //applyParams(postModel.find().where('repost_of', 0), params, maxid, callback)
      // this optimized gets a range
      /*
      if (posts.length) {
        maxid=posts[0].id
      }
      if (maxid<20) {
        // by default downloads the last 20 posts from the id passed in
        // so use 20 so we don't go negative
        // FIXME: change to scoping in params adjustment
        maxid=20
      }
      //console.log('getGlobal - max post id in data store is '+maxid)

      if (params.before_id) {
        if (!params.since_id) {
          params.since_id=Math.max(params.before_id-count, 0)
        }
      } else if (params.since_id) {
        // no before but we have since
        // it's maxid+1 because before_id is exclusive
        params.before_id=Math.min(params.since_id+count, maxid+1)
      } else {
        // if we have upstream enabled
        // none set
        params.before_id=maxid
        params.since_id=maxid-count
        // if we don't have upstream disable
        // best to proxy global...
      }
      var inlist=[]
      //console.log("from "+params.since_id+' to '+params.before_id)
      var meta={ code: 200, more: true }
      // I haven't see params on the global stream that don't include more
      // unless it's a 404
      if (params.since_id>maxid) {
        meta.more=false
      }
      if (params.before_id<1) {
        meta.more=false
      }
      if (params.count>=0) {
        // count is positive
        var apiposts=[]
        for(var pid=params.before_id-1; pid>params.since_id && inlist.length<count; pid--) {
          inlist.push(pid)
        }
        if (inlist.length) {
          meta.min_id=inlist[inlist.length-1]
          meta.max_id=inlist[0]
        }
        if (inlist.length==count && pid>params.since_id) {
          meta.more=true
        }
      } else {
        // count is negative
        for(var pid=params.since_id+1; pid<params.before_id && inlist.length<count; pid++) {
          inlist.push(pid)
        }
        if (inlist.length) {
          meta.min_id=inlist[0]
          meta.max_id=inlist[inlist.length-1]
        }
        if (inlist.length==count && pid<params.before_id) {
          meta.more=true
        }
      }
      //console.log(meta)
      //console.dir(inlist)
      if (inlist.length) {
        var posts=[]
        inlist.map(function(current, idx, Arr) {
          // get the post
          ref.getPost(current, function(post, err, postMeta) {
            posts.push(post)
            //console.log('posts',posts.length,'inlist',inlist.length)
            if (posts.length==inlist.length) {
              // if negative count, we need to reverse the results
              if (params.count<0) {
                posts.reverse()
              }
              //for(var i in posts) {
                //var post=posts[i]
                //console.log('got '+post.id)
              //}
              //console.log('sending',posts.length)
              callback(posts, null, meta)
            }
          })
        }, ref)
      } else {
        callback([], null, meta)
      }
      */
    //})
  },
  searchPosts: function(query, params, callback) {
    applyParams(postModel.find().where('text', { like: '%'+query+'%' }), params, function(posts, err, meta) {
      callback(posts, err, meta)
    })
  },
}
