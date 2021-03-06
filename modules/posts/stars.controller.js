module.exports = {
  //
  // star (interaction)
  //
  // id is meta.id, not sure what this is yet
  addStar: function(postid, token, callback) {
    const ref = this
    // FIXME: get post first
    // manually hack the output with the incremented counts
    // then write to db after returned
    // supposed to return post
    this.cache.addStar(postid, token, function() {
      ref.getPost(postid, {}, callback)
    })
  },
  delStar: function(postid, token, callback) {
    this.cache.delStar(postid, token, callback)
  },
  /**
   * add/update star
   * @param {object} data - stream star object
   * @param {boolean} deleted - star/unstar
   * @param {number} ts - timestamp of event
   * @param {metaCallback} callback - function to call after completion
   */
  setStar: function(data, deleted, id, ts, callback) {
    // and what if the posts doesn't exist in our cache?
    // update post
    // yea, there was one post that didn't has post set
    if (data && data.post) {
      this.setPost(data.post)
    }
    // update user record
    if (data && data.user && data.user.username) {
      this.updateUser(data.user, ts)
    }
    // create/update star
    if (data) {
      // we don't need source user because that'll be in the post
      // though maybe able to remove a look up if we pass it
      this.cache.setInteraction(data.user.id, data.post.id, 'star', id, deleted, ts, callback)
    } else {
      if (deleted) {
        this.cache.setInteraction(0, 0, 'star', id, deleted, ts, callback)
      } else {
        console.log('dispatcher.js::setStar - Create empty?')
        if (callback) {
          callback(null, null)
        }
      }
    }
    if (this.notsilent) {
      process.stdout.write(deleted ? '_' : '*')
    }
  },
  /**
   * get interactions from data access
   * @param {metaCallback} callback - function to call after completion
   */
  getInteractions: function(userid, tokenObj, params, callback) {
    //console.log('getInteractions - ', userid, typeof(tokenObj), typeof(params), typeof(callback))
    const ref = this
    params.tokenobj = tokenObj
    // FIXME: why do we need this getUser call?
    // is this just used to normalize the userid?
    // it's to insert ourselves as a receiver of actions
    this.getUser(userid, params, function(err, user) {
      if (err) console.error('stars.controller.js::getInteractions - getUser err', err)
      if (!user || !user.id) {
        callback(new Error('no such user'), [])
        return
      }
      // o(3) maybe 4 if toApi
      //console.log('getInteractions - gotUser')
      // was base class getting in the way
      //console.log('getInteractions - calling', userid, params, tokenObj)
      ref.cache.getNotices(userid, params, tokenObj, function(err, notices) {
        //console.log('dispatcher.js::getInteractions - gotNotice', notices.length)
        if (err) console.error('stars.controller.js::getInteractions - getNotices err', err)

        // actionuserid <= may have to look this up too
        // look up: notice.postid => post
        // look up: post.user.id => post.user
        // we can roll up multiple entries for same type and post objects
        if (!notices.length) {
          callback(err, [])
          return
        }
        const interactions = {}
        // we need to maintain the order of the result set
        function resortReturn(err, interactions) {
          if (err) console.error('stars.controller.js::getInteractions - resortReturn Err', err)
          //console.log('dispatcher.js::getInteractions - resortReturn')
          const res = []
          for (const i in notices) {
            const id = notices[i].id
            if (interactions[id]) {
              res.push(interactions[id])
            } else {
              console.log('cant find', id, 'in', interactions)
            }
          }
          //console.log('dispatcher.js::getInteractions - calling back')
          callback(err, res)
        }
        let count = 0
        for (const i in notices) {
          const notice = notices[i]
          ;
          (function(notice) {
            if (notice.type === 'follow') {
              // follow, look up user
              // if we use use the dispatcher one then we don't need to conver it
              //typeid is who was followed
              // but it would be action user followed typeid
              ref.getUser(notice.actionuserid, { tokenobj: tokenObj }, function(err, fuser) {
                if (err) console.error('stars.controller.js::getInteractions - getUser Err', err)
                if (!fuser) {
                  fuser = {
                    id: 0,
                    username: 'deleteduser',
                    created_at: '2014-10-24T17:04:48Z',
                    avatar_image: {
                      url: 'https://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
                    },
                    cover_image: {
                      url: 'https://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
                    },
                    counts: {
                      following: 0
                    }
                  }
                }
                interactions[notice.id] = {
                  event_date: notice.event_date,
                  action: 'follow',
                  objects: [
                    user
                  ],
                  users: [
                    fuser
                  ],
                  pagination_id: notice.id
                }
                count++
                if (count === notices.length) {
                  //console.log('dispatcher.js::getInteractions - resortReturn')
                  resortReturn(err, interactions)
                }
              })
            } else {
              // probably a star
              // not follow, look up post
              // if we use use the dispatcher one then we don't need to conver it
              ref.getUser(notice.actionuserid, { tokenobj: tokenObj }, function(err, auser) {
                if (err) console.error('stars.controller.js::getInteractions - getUser2 Err', err)
                ref.getPost(notice.typeid, {}, function(err, post) {
                  if (err) console.error('stars.controller.js::getInteractions - getPost Err', err)
                  interactions[notice.id] = {
                    event_date: notice.event_date,
                    action: notice.type,
                    objects: [
                      post
                    ],
                    users: [
                      auser
                    ],
                    pagination_id: notice.id
                  }
                  if (notice.altnum) {
                    ref.getPost(notice.altnum, {}, function(err, post2) {
                      interactions[notice.id].objects.push(post2)
                      count++
                      if (count === notices.length) {
                        //console.log('dispatcher.js::getInteractions - resortReturn')
                        resortReturn(err, interactions)
                      }
                    })
                  } else {
                    count++
                    if (count === notices.length) {
                      //console.log('dispatcher.js::getInteractions - resortReturn')
                      resortReturn(err, interactions)
                    }
                  }
                })
              })
            }
          }(notice))
        }
        //console.log('getInteractions - done')
        //callback(interactions, err)
      })
    })
  },
  getInteractions2: function(userid, token, params, callback) {
    // probably will needs params
    // if each returns 0-count, that should be more than enough to fulfill count
    // 4xcount but let's say we get less than count, that means there isn't the data
    // so we can't provide more
    //const interactions = [] // [ts, {}]
    // get a list of interactions for this user
    // interactions are follows = users
    // stars, reposts, reply = posts
    // welcome will be empty
    // broadcast_create, broadcast_subscribe, broadcast_subscribe will be channels
    // build a list sorted by timestamp
    const ref = this
    let done_follows = 0
    let done_stars = 0
    let done_reposts = 0
    let done_replies = 0
    //var list=[] // (timestamp, action, objects, users)
    let sent = 0
    const checkdone = function() {
      if (sent) return
      const list = followlist.concat(starlist).concat(repostlist).concat(replieslist)
      console.log('dispatcher.js::getInteractions check', done_follows, done_stars, done_reposts, done_replies, 'items', list.length)
      if (done_follows && done_stars && done_reposts && done_replies) {
        //console.log('dispatcher.js::getInteractions done')
        sent = 1 // sent lock
        //ref.getUser(userid, null, function(self, err) {
        //console.log('self')
        /*
          ref.getUser(2, null, function(actor, err) {
            //console.log('berg')
            var interaction={
                "action": "follow",
                "event_date": "2012-07-16T17:23:34Z",
                "objects": [
                  self
                ],
                "users": [
                  actor
                ]
            }
            // pagination_id
            //console.log('sending back')
            callback([interaction], null)
          })
          */
        // since we only need count (20)
        // let's only do the getUser here
        const interactions = []
        console.log('dispatcher.js::getInteractions - list len', list.length)
        // so the way node works is that if we have 900 items
        // we have to issue all 900 items before we'll get one response
        for (const i in list) {
          if (i > 20) break
          // yield and then run this
          //setImmediate(function() {
          ref.getUser(list[i][3], null, function(fuser, err) {
            const interaction = {
              event_date: list[i][0],
              action: list[i][1],
              objects: [
                list[i][2]
              ],
              users: [
                fuser
              ]
            }
            //console.log(interaction.objects,interaction.users)
            interactions.push(interaction)
            console.log('i', i, 'len', interactions.length)
            if (interactions.length === list.length || interactions.length === 20) {
              // 16-70s on 54posts 0 followers
              console.log('sending')
              callback(null, interactions)
            }
          })
          //})
        }
        console.log('for is done, waiting on getUser')
        //console.log('sending',interactions.length)
        //callback(interactions, null)
        //})
      }
    }
    // follows
    const followlist = []
    let followexpect = 0
    // only need the most recent 20 follows
    console.log('getting followers for', userid)
    // lookup self first, and then get down to business
    this.getUser(userid, null, function(err, user) {
      if (err) console.error('stars.controller:: - getUser err', err)
      ref.cache.getFollows(userid, { count: 20 }, function(err, follows) {
        if (err) console.error('stars.controller:: - getFollows err', err)
        if (!follows.length) {
          done_follows = 1
          checkdone()
        } else {
          for (const i in follows) {
            const follow = follows[i]
            if (follow.active) {
              followexpect++
              done_follows = 0
              //console.log('expecting',followexpect)
              //ref.getUser(follow.userid, null, function(fuser, err) {
              followlist.push([follow.last_updated, 'follow', user, follow.userid])
              //console.log('got',followlist.length,'vs',followexpect)
              if (followlist.length === followexpect) {
                // move it into the main list
                done_follows = 1
                checkdone()
              }
              //})
            }
          }
          if (followexpect === 0) {
            console.log('stars.controller:: - no active followers')
            done_follows = 1
          }
          checkdone()
        }
      })
    })
    // stars
    const starlist = []
    // not that I starred a post...
    /*
    this.cache.getInteractions('star', userid, { count: 20 }, function(err, stars) {
      if (!stars.length) {
        done_stars=1
      } else {
        for(var i in stars) {
          var star=stars[i]
          ref.getUser(userid, null, function(user, err) {
            ref.getPost(star.typeid, null, function(post, err) {
              starlist.push([star.datetime, 'star', post, user])
              console.log('*i',i,'vs',stars.length,'vs',starlist.length,'starlist')
              if (starlist.length==stars.length) {
                // move it into the main list
                done_stars=1
                checkdone()
              }
            })
          })
        }
      }
      checkdone()
    })
    */
    const repostlist = []
    const replieslist = []
    // can't count 20, we want any activity on all our posts
    this.getUserPosts(userid, { }, function(err, posts) {
      if (err) console.error('stars.controller::getInteractions2 getUserPosts err', err)
      if (!posts.length) {
        console.log('no posts')
        done_reposts = 1
        done_replies = 1
        done_stars = 1
        checkdone()
        return
      }
      let repostcount = 0
      let replycount = 0
      let starcount = 0
      let postrepostcalls = 0
      let postreplycalls = 0
      let poststarcalls = 0
      console.log('posts', posts.length)
      let postcalls = 0
      for (const i in posts) {
        const post = posts[i]
        // skip delete posts...
        if (post.deleted) continue
        postcalls++
        // reposts
        // get a list of all my posts, did any of them were a repost_of
        // up to 20 reposts (as long as their reposts replies)
        ref.cache.getReposts(post.id, { count: 20 }, token, function(err, reposts) {
          if (err) console.error('stars.controller.js - getPosts err', err)
          /*
          if (!reposts.length) {
            console.log('well no reposts, let\'s check on things. posts: ',postcalls,'postrepostcalls',postrepostcalls)
          }
          */
          //done_reposts=1
          //} else {
          repostcount += reposts.length
          for (const j in reposts) {
            const repost = reposts[j]
            //ref.getUser(repost.userid, null, function(ruser, err) {
            repostlist.push([repost.created_at, 'repost', post, repost.userid])
            //console.log('Pi',i,'vs',posts.length)
            console.log('repost check', repostlist.length, 'vs', repostcount, 'repostcalls', postrepostcalls, '/', postcalls)
            if (repostlist.length === repostcount && postcalls === postrepostcalls) {
              // move it into the main list
              // we're hitting this early
              done_reposts = 1
              checkdone()
            }
            //})
          }
          postrepostcalls++
          if (postrepostcalls === postcalls) {
            // we're done, there maybe repostcount outstanding, let's check
            console.log('repost done, count:', repostcount, 'done:', repostlist.length)
            // if we never requested anything, then we're done
            if (!repostcount || repostcount === repostlist.length) {
              done_reposts = 1
              checkdone()
            }
          }
          //}
        })
        // replys
        // get a list of all my posts, reply_to
        //console.log('Calling getReplies')
        // up to 20 replies (as long as their recent replies)
        ref.cache.getReplies(post.id, { count: 20 }, token, function(err, replies) {
          if (err) console.error('stars.controller.js - getReplies err', err)
          //if (!replies.length) {
          //done_replies=1
          //} else {
          replycount += replies.length
          for (const j in replies) {
            const reply = replies[j]
            //ref.getUser(reply.userid, null, function(ruser, err) {
            replieslist.push([reply.created_at, 'reply', post, reply.userid])
            //console.log('Li',i,'vs',posts.length)
            console.log('reply check', replieslist.length, 'vs', replycount, 'replycalls', postreplycalls, '/', postcalls)
            if (replieslist.length === replycount && postcalls === postreplycalls) {
              // move it into the main list
              done_replies = 1
              checkdone()
            }
            //})
          }
          //console.log('uWotM8?',postreplycalls,'/',postcalls)
          postreplycalls++
          if (postreplycalls === postcalls) {
            // we're done, there maybe repostcount outstanding, let's check
            console.log('reply done, count:', replycount, 'done:', replieslist.length)
            // if we never requested anything, then we're done
            if (!replycount || replycount === replieslist.length) {
              done_replies = 1
              checkdone()
            }
          }
          //}
        })
        // get people that have starred your posts
        // up to 20 stars (as long as their recent stars)
        ref.cache.getPostStars(post.id, { count: 20 }, function(err, starredposts) {
          if (err) console.error('stars.controller.js - getPostStars err', err)
          starcount += starredposts.length
          for (const j in starredposts) {
            const starpost = starredposts[j]
            //ref.getUser(starpost.userid, null, function(ruser, err) {
            starlist.push([starpost.created_at, 'star', post, starpost.userid])
            //console.log('Li',i,'vs',posts.length)
            console.log('star check', starlist.length, 'vs', starcount, 'starscalls', poststarcalls, '/', postcalls)
            if (starlist.length === starcount && postcalls === poststarcalls) {
              // move it into the main list
              done_stars = 1
              checkdone()
            }
            //})
          }
          poststarcalls++
          if (poststarcalls === postcalls) {
            // we're done, there maybe repostcount outstanding, let's check
            console.log('star done, count:', starcount, 'done:', starlist.length)
            // if we never requested anything, then we're done
            if (!starcount || starcount === starlist.length) {
              done_stars = 1
              checkdone()
            }
          }
        })
      }
      console.log('postcalls', postcalls)
      console.log('counts', repostcount, replycount)
      if (!postcalls) {
        // if no valid posts to inspect, we're done
        done_reposts = 1
        done_replies = 1
        done_stars = 1
      } else {
        // if post checks are done and there's no repostcost, then it's done
        // do we even need these? if there are psts, we deal with it in the replycount
        console.log('postcalls', postcalls)
        console.log('reposts', postrepostcalls, 'counts', repostcount, replycount)
        console.log('replies', postreplycalls, 'counts', replycount)
        console.log('stars', poststarcalls, 'counts', starcount)
        //if (postcalls==postrepostcalls && !repostcount) done_reposts=1
        //if (postcalls==postreplycalls && !replycount) done_reposts=1
        //if (postcalls==poststarcalls && !starcount) done_stars=1
      }
      checkdone()
    }) // getUserPosts
  },
  /**
   * get range of stared posts for user id userid from data access
   * @param {number} userid - the user id to get posts for
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getUserStars: function(userid, params, callback) {
    //console.log('dispatcher.js::getUserStars start')
    if (!params.count) params.count = 20
    const ref = this
    if (userid === 'me') {
      if (params.tokenobj && params.tokenobj.userid) {
        //console.log('dispatcher.js::getUserStars - me became', params.tokenobj.userid)
        this.getUserStars(params.tokenobj.userid, params, callback)
        return
      } else {
        console.log('dispatcher.js::getUserStars - userid is me but invalud token', params.tokenobj)
        callback(new Error('no or invalid token'), [])
        return
      }
    }

    this.cache.getInteractions('star', userid, params, function(err, interactions, meta) {
      // make sure stars are up to date
      if (ref.downloader.apiroot !== 'NotSet') {
        console.log('dispatcher.js::getUserStars - start d/l')
        ref.downloader.downloadStars(userid)
        console.log('dispatcher.js::getUserStars - end d/l')
      }
      //console.log('dispatcher.js::getUserStars - ', interactions)
      // data is an array of interactions
      if (interactions && interactions.length) {
        const apiposts = []
        interactions.map(function(current, idx, Arr) {
          // we're a hasMany, so in theory I should be able to do
          // record.posts({conds})
          // get the post in API foromat
          //console.log('dispatcher::getUserStars - tokenobj', params.tokenobj)
          ref.getPost(current.typeid, params, function(err, post, meta) {
            //console.dir(post)
            if (post && post.user && post.text) { // some are deleted, others are errors
              apiposts.push(post)
            } else {
              interactions.pop()
            }
            // join
            // params.count is requested rpp
            //console.log(apiposts.length+'/'+interactions.length+' or '+params.count)
            // interactions.length looks good
            if (apiposts.length === params.count || apiposts.length === interactions.length) {
              //console.log('dispatcher.js::getUserStars - finishing', apiposts.length)
              console.log('stars.controller.js::getUserStars - meta', meta)
              if (!meta) {
                meta = {
                  code: 200
                }
              }
              callback(err, apiposts, meta)
            }
          })
        }, ref)
      } else {
        // no interactions
        //console.log('dispatcher.js::getUserStars - finishing but no stars for', userid, params)
        callback(err, [], meta)
      }
    })
  }
}
