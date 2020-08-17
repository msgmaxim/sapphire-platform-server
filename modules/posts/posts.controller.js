// copyentities
const entitiesController = require('../users/entities.controller')

let first_post_id
let last_post_id

module.exports = {
  /** posts */
  // tokenObj isn't really used at this point...
  // difference between stream and api?
  addPost: function(post, tokenObj, callback) {
    //console.log('posts.controller::addPost post - ', post)
    //console.log('posts.controller::addPost tokenObj - ', tokenObj)
    const ref = this
    function makePost() {
      //console.log('posts.controller::addPost annotations - ', post.annotations)
      // text, entities, postcontext, callback
      ref.cache.addPost(post, tokenObj, function(err, dbpost, meta) {
        if (err) {
          console.error('posts.controller::addPost - err', err)
        }

        // well we have to wait until we have the post.id and then we can write it
        function finishCreatingPost() {
          ref.setEntities('post', dbpost.id, post.entities, function() {
            //console.log('posts.controller.js::addPost - Entities set', post.entities.links)
            ref.postToAPI(dbpost, {}, tokenObj, function(err, apiPost, meta) {
              ref.pumpStreams({
                id: dbpost.id,
                type: 'post',
                op: 'add',
                actor: post.userid
              }, apiPost)
              callback(err, apiPost, meta)
            }, meta)
          })
        }

        //console.log('posts.controller::addPost dbpost - ', dbpost)
        if (dbpost) {
          // FIXME: annotations may not be returned on post creation
          if (post.annotations) {
            ref.setAnnotations('post', dbpost.id, post.annotations)
          }
          //console.log('posts.controller.js::addPost - GotPost', dbpost.id)

          //console.log('posts.controller.js::addPost - postToAPI params', params)

          if (post.html.match(/{post_id}/) || post.text.match(/{post_id}/)) {
            //console.log('posts.controller.js::addPost - {post_id} live tag detected')
            //console.log('posts.controller.js::addPost - reading', dbpost.id, 'got', dbpost.text)
            // recalculate entities and html
            ref.textProcess(dbpost.text, false, true, function(err, textProc) {
              if (err) console.error('posts.controller.js::addPost - textProc err', err)
              //console.log('posts.controller.js::addPost - got new links', textProc.entities.links)
              // need dbpost for the id
              //dbpost.html=textProc.html
              //console.log('posts.controller.js::addPost - rewriting HTML to', dbpost.html, 'for', dbpost.id)
              //updatePostHTML: function(postid, html, callback) {
              //ref.cache.setPost(dbpost, function(fixedPost, err) {
              ref.cache.updatePostHTML(dbpost.id, textProc.html, function(err, fixedPost) {
                if (err) console.error('posts.controller.js::addPost - fixedPost', err)
                if (fixedPost) {
                  //console.log('posts.controller.js::addPost - fixedPost', fixedPost)
                  dbpost = fixedPost
                  post.entities = textProc.entities
                  //console.log('posts.controller.js::addPost - new entity links', post.entities.links)
                  finishCreatingPost()
                }
              })
            })
          } else {
            finishCreatingPost()
          }
        } else {
          // may need to delete entities
          callback(null, 'empty_result')
        }
      })
    }

    const postDone = {
      html: false,
      thread: false
    }
    function setDone(type) {
      postDone[type] = true
      // if something is not done
      //console.log('posts.controller.js::addPost - checking if done')
      for (const i in postDone) {
        if (!postDone[i]) {
          //console.log('posts.controller.js::addPost -', i, 'is not done')
          return
        }
      }
      //console.log('posts.controller.js::addPost - done', data, meta)
      //console.log('posts.controller.js::addPost - done, text', data.text)
      // everything is done
      makePost()
      //callback(data, null, meta)
    }

    function getEntities(post, cb) {
      ref.textProcess(post.text, post.entities, true, function(err, textProc) {
        if (err) console.error('posts.controller.js::addPost - textProc err', err)
        //console.log('posts.controller.js::addPost - textProc', textProc)
        post.entities = textProc.entities
        post.html = textProc.html
        cb()
      })
    }
    // check out postToAPI
    // needs to run before textProcess
    function checkTagUser(post, cb) {
      if (!((post.text && post.text.match(/{username}/)) || (post.html && post.html.match(/{username}/)))) {
        cb()
        return
      }
      ref.cache.getUser(post.userid, function(err, user, meta) {
        if (err) console.error('posts.controller.js::addPost - checkTagUser err', err)
        if (post.text && post.text.match(/{username}/)) {
          post.text = post.text.replace(new RegExp('{username}', 'g'), user.username)
        }
        if (post.html && post.html.match(/{username}/)) {
          post.html = post.html.replace(new RegExp('{username}', 'g'), user.username)
        }
        cb()
      })
    }
    function getThreadID(post, cb) {
      // cache expects post to be in our internal db format
      //console.log('posts.controller.js::addPost getThreadID post.reply_to', post.reply_to)
      if (post.reply_to) {
        ref.cache.getPost(post.reply_to, function(err, parentPost, meta) {
          if (err) console.error('posts.controller.js::addPost - getThreadID err', err)
          post.thread_id = parentPost.thread_id
          //console.log('post.threadid', post.thread_id)
          cb()
        })
      } else {
        cb()
      }
    }
    // these both mess with .html / .text
    checkTagUser(post, function() {
      // after username is in place, we'll have better positions
      getEntities(post, function() {
        setDone('html')
      })
    })
    getThreadID(post, function() {
      setDone('thread')
    })
  },
  // deletePost
  // FIXME change API to access params
  delPost: function(postid, token, callback) {
    //console.log('posts.controller.js::delPost - postid', postid)
    const ref = this
    this.getPost(postid, {}, function(err, post, postMeta) {
      //console.log('posts.controller.js::delPost - getPost', post)
      if (err) {
        console.error('posts.controller.js::delPost - err getPost', err)
      }
      if (!post) {
        console.warn('posts.controller.js::delPost - postid', postid, 'not found')
        return
      }
      // this is the adn version of the post...
      if (post.user.id !== token.userid) {
        console.warn('posts.controller.js::delPost - permissions denied, post owner', post.userid, 'token owner', token.userid)
        callback(new Error('access denied to post'), post, {
          code: token ? 403 : 401
        })
        return
      }
      ref.cache.delPost(postid, function(dbErr, delRes, dbMeta) {
        // delRes are
        /*
        OkPacket {
          fieldCount: 0,
          affectedRows: 0,
          insertId: 0,
          serverStatus: 2,
          warningCount: 0,
          message: '(Rows matched: 0  Changed: 0  Warnings: 0',
          protocol41: true,
          changedRows: 0
        }
        */
        //console.log('posts.controller.js::delPost - returning', post)
        /*
        const params = {
          generalParams: {
            deleted: true
          }
        }
        */
        // postToAPI: function(post, params, tokenObj, callback, meta) {
        //getPost: function(id, params, callback) {
        //ref.getPost(postid, params, callback)
        post.is_deleted = true
        callback(dbErr, post, postMeta)
        /*
        ref.postToApi(post, { }, function(apiPost, err) {
          ref.pumpStreams({
            id: postid,
            type: 'post',
            op:   'del',
          }, apiPost)
          callback(apiPost, err, dbMeta)
        })
        */
      })
    })
  },
  /**
   * Add/Update post in data store
   * @param {object} post - the new post object (in API format)
   * @param {setPostCallback} callback - function to call after completion
   */
  setPost: function(post, callback) {
    if (!post) {
      console.log('posts.controller.js::setPost - post is not set!')
      if (callback) {
        callback(null, 'setPost - post is not set!')
      }
      return
    }
    if (!post.id) {
      console.log('posts.controller.js::setPost - no id in post', post)
      if (callback) {
        callback(null, 'setPost - no id in post')
      }
      return
    }
    const ref = this

    // we're assuming we're getting a contiguous amount of posts...
    // get a sample of where the app stream is starting out
    if (first_post_id === undefined) {
      // not a good way to do this,
      // some one can interact (delete?) an older post with a much lower id
      console.log('Setting first post to', post.id)
      first_post_id = post.id
    }

    post.date = new Date(post.created_at)
    post.ts = post.date.getTime()

    // update user first, to avoid proxy
    if (post.user && post.user.id) {
      // update User records
      /*
      if (post.user.description && post.user.description.entities) {
        console.log('disptacher.js::setPost '+post.id+' has user entites')
      } else {
        console.log('disptacher.js::setPost '+post.id+' has NO user entites')
        //console.dir(post.user)
      }
      */
      this.updateUser(post.user, post.ts, function(user, err) {
        if (err) console.error('User Update err', err)
        //console.log("User Updated")
      })
    }
    if (post.entities) {
      this.setEntities('post', post.id, post.entities, function(entities, err) {
        if (err) console.error('entities Update err', err)
        //console.log("entities Updated")
      })
    }
    //console.log('posts.controller.js::setPost post id is '+post.id)
    const dataPost = post
    //dataPost.id=post.id // not needed
    if (post.user) {
      dataPost.userid = post.user.id
    } else {
      // usually on deletes, they don't include the user object
      //console.log('No Users on post ', post)
      /*
{ created_at: '2013-08-16T01:10:29Z',
  num_stars: 0,
  is_deleted: true,
  num_replies: 0,
  thread_id: '9132210',
  deleted: '1',
  num_reposts: 0,
  entities: { mentions: [], hashtags: [], links: [] },
  machine_only: false,
  source:
   { link: 'http://tapbots.com/software/netbot',
     name: 'Netbot for iOS',
     client_id: 'QHhyYpuARCwurZdGuuR7zjDMHDRkwcKm' },
  reply_to: '9132210',
  id: '9185233',
  date: Thu Aug 15 2013 18:10:29 GMT-0700 (PDT),
  ts: 1376615429000 }
      */
    }
    dataPost.created_at = new Date(post.created_at) // fix incoming created_at iso date to Date

    function finishSending(err, dataPost, meta) {
      ref.pumpStreams({
        id: post.id,
        type: 'post',
        op: 'add', // really isn't an update
        actor: post.user.id
      }, dataPost)
      callback(dataPost, err, meta)
    }

    //console.log('posts.controller::setPost - user is', post.userid)
    if (post.source) {
      const ref = this
      this.cache.setSource(post.source, function(err, client) {
        if (err) console.error('posts.controller::setPosts - setSource err', err)
        // param order is correct
        //console.log('addPost setSource returned ', client, err, dataPost)
        if (err) {
          console.log('can\'t setSource', err)
        } else {
          dataPost.client_id = client.client_id
        }
        //console.log('posts.controller.js::setPost datapost id is '+dataPost.id)
        ref.cache.setPost(dataPost, finishSending)
      })
    } else {
      //console.log('posts.controller.js::setPost datapost id is '+dataPost.id)
      this.cache.setPost(dataPost, finishSending)
    }

    if (post.annotations) {
      this.setAnnotations('post', post.id, post.annotations)
    }

    if (last_post_id === undefined || post.id > last_post_id) {
      //console.log("Setting last post to ", post.id)
      last_post_id = post.id
    }
    // can't clear this because we're still processing it
    //dataPost=null
    if (this.notsilent) {
      process.stdout.write('P')
    }
  },
  // set shit like you_starred, you_reposted, etc
  contextualizePostRepsonse: function(post, token, callback) {
    //
  },
  // convert ADN format to DB format
  apiToPost: function(api, meta, callback) {
    if (!api.user) {
      console.log('apiToPost - api user is missing', api.user, api)
      if (callback) {
        callback(null, 'no api user')
      }
      return
    }
    // copy api
    const post = JSON.parse(JSON.stringify(api))
    post.date = new Date(api.created_at)
    post.ts = post.date.getTime()
    post.user.created_at = new Date(api.user.created_at)
    post.userid = api.user.id
    // repost_of?
    // it's an object in api and an numericid in DB
    if (api.repost_of) {
      // is this right in the case of repost of a repost?
      post.repost_of = api.repost_of.id
    }
    // source
    if (post.source) {
      // find it (or create it for caching later)
      this.cache.setSource(post.source, function(err, client) {
        if (err) {
          console.log('can\'t setSource ', err)
        } else {
          post.client_id = client.client_id
        }
        callback(post, err, meta)
      })
    } else {
      callback(post, null, meta)
    }
    //return post
  },
  /**
   * convert DB format to API structure
   * @param {object} post - the new post object
   * @param {object} params - the request parameters (load annotations)
   * @param {object} token - the request context (which user/client)
   * @param {setPostCallback} callback - function to call after completion
   * @param {object} meta - the meta data
   */
  postToAPI: function(post, params, tokenObj, callback, meta) {
    //console.log('posts.controller.js::postToAPI('+post.id+') - start', post, params, tokenObj, meta)
    if (!post) {
      console.log('posts.controller.js::postToAPI - no post data passed in')
      callback(null, 'no_post')
      return
    }
    if (!post.userid) {
      console.log('posts.controller.js::postToAPI - no userid', post)
      callback(null, 'no_userid')
      return
    }
    const ref = this // back it up

    // set up new final object for collection

    const data = {}
    // , 'source', 'user'
    const postFields = ['id', 'text', 'html', 'canonical_url', 'created_at',
      'machine_only', 'num_replies', 'num_reposts', 'num_stars', 'thread_id',
      'entities', 'is_deleted']
    for (const i in postFields) {
      const f = postFields[i]
      data[f] = post[f]
    }
    // hack
    if (data.text === undefined && data.html === undefined) {
      console.log('posts.controller.js::postToAPI(' + post.id + ') - no text or html')
      data.text = ''
      data.html = ''
    }
    if (data.html && !data.text) data.text = data.html
    if (!data.html && data.text) data.html = data.text

    //if (typeof(data.created_at)!=='object') {
    //console.log('posts.controller::postToAPI - created_at isnt a date', typeof(data.created_at), data.created_at)
    if (!data.created_at) {
      console.log('posts.controller::postToAPI - created_at isnt object', data.created_at)
      data.created_at = new Date(data.created_at)
      console.log('posts.controller::postToAPI - created_at converted to', data.created_at.toString())
    }

    // convert TS to date object
    //console.log('posts.controller::postToAPI - created_at check', data.created_at)
    if (isNaN(data.created_at.getTime())) {
      //delete data.created_at
      data.created_at = '2000-01-01T00:00:00.000Z'
      data.is_deleted = true
    } else {
      data.created_at = new Date(data.created_at)
    }

    //console.log(post.num_replies+' vs '+data.num_replies)
    //'repost_of'
    const postFieldOnlySetIfValue = ['reply_to']
    for (const i in postFieldOnlySetIfValue) {
      const f = postFieldOnlySetIfValue[i]
      if (post[f]) {
        data[f] = post[f]
      }
    }
    //data.user=user
    //console.log('posts.controller.js::postToAPI - return check', data)

    const postDone = {
      client: false,
      user: false,
      entities: false,
      repostOf: false,
      annotation: false,
      context: false
    }

    if (params && params.generalParams) {
      if (params.generalParams.starred_by) {
        //console.log('posts.controller.js::postToAPI('+post.id+') - include_starred_by - write me!')
        postDone.starred_by = false
        this.cache.getPostStars(post.id, {}, function(err, interactions, meta) {
          if (err) console.error('posts.controller.js::postToAPI - loadContext getUserStarPost err', err)
          if (!interactions || !interactions.length) {
            data.starred_by = []
            setDone('starred_by')
            return
          }
          const userids = []
          for (const i in interactions) {
            const action = interactions[i]
            userids.push(action.userid)
          }
          //console.log('posts.controller.js::postToAPI('+post.id+') - include_starred_by - getting users', userids)
          ref.cache.getUsers(userids, params, function(userErr, userObjs, meta) {
            if (err) console.error('posts.controller.js::postToAPI - loadContext getUsers err', err)
            //console.log('posts.controller.js::postToAPI('+post.id+') - include_starred_by - got', userObjs.length)
            const rUsers = []
            for (const i in userObjs) {
              ref.userToAPI(userObjs[i], tokenObj, function(err, adnUserObj) {
                if (err) console.error('posts.controller.js::postToAPI - userToAPI err', err)
                //console.log('posts.controller.js::postToAPI - got', adnUserObj, 'for', users[i])
                rUsers.push(adnUserObj)
                //console.log('posts.controller.js::postToAPI('+post.id+') - include_starred_by - ', rUsers.length, 'vs', userids.length)
                if (rUsers.length === userids.length) {
                  data.starred_by = rUsers
                  //console.log('marking starred_by done')
                  setDone('starred_by')
                }
              }, meta)
            }
          })
        })
      }
      if (params.generalParams.reposters) {
        //console.log('posts.controller.js::postToAPI('+post.id+') - include_reposters - write me!')
        postDone.reposters = false
        this.cache.getReposts(post.id, {}, tokenObj, function(err, posts, meta) {
          if (err) console.error('posts.controller.js::postToAPI - getReposts err', err)
          if (!posts || !posts.length) {
            data.reposters = []
            setDone('reposters')
            return
          }
          const userids = []
          for (const i in posts) {
            const post = posts[i]
            if (userids.indexOf(post.userid) === -1) {
              userids.push(post.userid)
            }
          }
          //console.log('posts.controller.js::postToAPI('+post.id+') - include_reposters - getting users', userids)
          ref.cache.getUsers(userids, params, function(userErr, userObjs, meta) {
            //console.log('posts.controller.js::postToAPI('+post.id+') - include_reposters - got', userObjs.length)
            const rUsers = []
            for (const i in userObjs) {
              ref.userToAPI(userObjs[i], tokenObj, function(err, adnUserObj) {
                if (err) console.error('posts.controller.js::postToAPI - userToAPI err', err)
                //console.log('posts.controller.js::postToAPI - got', adnUserObj, 'for', adnUserObj.id)
                rUsers.push(adnUserObj)
                //console.log('posts.controller.js::postToAPI('+post.id+') - include_reposters - ', rUsers.length, 'vs', userids.length)
                if (rUsers.length === userids.length) {
                  //callback(rUsers, '')
                  data.reposters = rUsers
                  //console.log('marking reposters done')
                  setDone('reposters')
                }
              }, meta)
            }
          })
        })
      }
    } else {
      //if (params !== {}) {
      //console.log('posts.controller.js::postToAPI('+post.id+') - params dont have generalParams')
      //}
    }

    function setDone(type) {
      postDone[type] = true
      // if something is not done
      //console.log('posts.controller.js::postToAPI('+post.id+') - checking if done')
      for (const i in postDone) {
        if (!postDone[i]) {
          //console.log('posts.controller.js::postToAPI('+post.id+') -', i, 'is not done')
          return
        }
      }
      //console.log('posts.controller.js::postToAPI('+post.id+') - done', data, meta)
      //console.log('posts.controller.js::postToAPI('+post.id+') - done, text', data.text)

      //console.log('posts.controller.js::postToAPI('+post.id+') - params', params)
      // everything is done
      callback(null, data, meta)
    }

    function loadClient(post, cb) {
      if (post.repost_of) { // no need to look up client of a repost (atm but eventually should probably)
        // Alpha does need this
        const source = {
          link: 'https://sapphire.moe/',
          name: 'Unknown',
          client_id: 'Unknown'
        }
        cb(source) // was just ()
        return
      }
      ref.getClient(post.client_id, function(clientErr, client, clientMeta) {
        //console.log('posts.controller.js::postToAPI('+post.id+') - gotClient')
        let source = {
          link: 'https://sapphire.moe/',
          name: 'Unknown',
          client_id: 'Unknown'
        }
        if (client) {
          source = {
            link: client.link,
            name: client.name,
            client_id: client.client_id
          }
        } else {
          console.log('posts.controller.js::postToAPI(' + post.id + ') - client is', client, clientErr)
        }
        cb(clientErr, source, clientMeta)
      }) // getClient
    }

    function loadUser(userid, params, cb) {
      //console.log('posts.controller.js::postToAPI('+post.id+') - getting user '+post.userid)
      ref.getUser(userid, params, function(userErr, user, userMeta) {
        if (userErr) console.log('posts.controller.js::postToAPI(' + post.id + ') userid(', userid, ') - err', userErr)
        //console.log('posts.controller.js::postToAPI('+post.id+') userid(',userid,') - got user', user)
        if (!user) {
          user = {
            id: 0,
            username: 'likelydeleted',
            created_at: '2014-10-24T17:04:48Z',
            avatar_image: {
              url: ''
            },
            cover_image: {
              url: ''
            },
            counts: {
              following: 0
            }
          }
        }
        cb(userErr, user, userMeta)
      }) // getUser
    }

    const loadRepostOf = function(post, tokenObj, cb) {
      //console.log('posts.controller.js::postToAPI - return check', data)
      //console.log('posts.controller.js::postToAPI - Done, calling callback')
      // now fix up reposts
      if (post.repost_of) {
        //console.log('converting repost_of from ', post.repost_of)
        // use thread_id because we need a direct path back to the original
        // and we can use repost_of to find the share tree
        ref.getPost(post.thread_id, { tokenobj: tokenObj }, function(repostErr, repost, repostMeta) {
          //console.log('converting repost_of to', repostapi.id)
          //data.repost_of=repost
          //callback(data, err, meta)
          cb(repostErr, repost, repostMeta)
        })
      } else {
        //callback(data, err, meta)
        cb(null, false, false)
      }
    }

    const loadAnnotation = function(post, cb) {
      ref.getAnnotation('post', post.id, function(err, dbNotes, noteMeta) {
        if (err) console.error('posts.controller.js::postToAPI - err', err)
        const apiNotes = []
        for (const j in dbNotes) {
          const note = dbNotes[j]
          //console.log('got note', j, '#', note.type, '/', note.value, 'for', post.id)
          apiNotes.push({
            type: note.type,
            value: note.value
          })
        }
        cb(err, apiNotes, noteMeta)
      })
    }

    function loadEntites(post, cb) {
      // use entity cache (DB read or CPU calculate)
      if (1) {
        //console.log('posts.controller.js::postToAPI('+post.id+') - getEntity post. post.userid:', post.userid)
        ref.getEntities('post', post.id, function(entitiesErr, entities, entitiesMeta) {
          if (entitiesErr) console.error('posts.controller.js::postToAPI - getEntities err', entitiesErr)
          //console.log('posts.controller.js::postToAPI('+post.id+') - gotEntities')

          data.entities = {
            mentions: [],
            hashtags: [],
            links: []
          }
          entitiesController.copyentities('mentions', entities.mentions, data, 1)
          entitiesController.copyentities('hashtags', entities.hashtags, data, 1)
          entitiesController.copyentities('links', entities.links, data, 1)
          // use html cache?
          if (1) {
            //console.log('posts.controller.js::postToAPI('+post.id+') - calling final comp')
            //finalcompsite(post, user, client, callback, err, meta)
            cb()
          } else {
            // generate HTML
            // text, entities, postcontext, callback
            ref.textProcess(post.text, post.entities, true, function(err, textProcess) {
              if (err) console.error('posts.controller.js::postToAPI - textProcess err', err)
              //console.dir(textProcess)
              data.html = textProcess.html
              //finalcompsite(post, user, client, callback, err, meta)
              cb()
            })
          }
        }) // getEntities
      } else {
        ref.textProcess(post.text, post.entities, true, function(err, textProcess) {
          if (err) console.error('posts.controller.js::postToAPI - textProcess err', err)
          data.entities = textProcess.entities
          data.html = textProcess.html
          //finalcompsite(post, user, client, callback, err, meta)
          cb()
        })
      }
    }

    // any value into breaking into 3 functions?
    // removed another checkDone style function
    const loadContext = function(post, tokenObj, cb) {
      // these will need to be queried:
      //   reposters
      //     Not completet & only included if include_reposters=1 is passed to App.net
      //   starred_by
      //     include_starred_by=1
      // so we have to query:
      // ok if token is a string we need to resolve it
      // otherwise we're good to go with an object
      //console.log('posts.controller.js::postToAPI:::loadContext - tokenObj', tokenObj)
      //console.log('posts.controller.js::postToAPI post', post.id, 'data', data.id, 'id', id)
      if (tokenObj && tokenObj.userid) {
        // if this post is a report that we reposted
        //if (post.repost_of && post.userid==token.userid) data.you_reposted=true
        let starDone = false
        let repostRepostDone = false
        let repostPostDone = false
        const checkDone = function() {
          //console.log('posts.controller.js::postToAPI:::loadContext - checkDone', starDone, repostRepostDone, repostPostDone)
          if (starDone && repostRepostDone && repostPostDone) {
            cb()
          }
        }
        ref.cache.getUserStarPost(tokenObj.userid, data.id, function(err, res) {
          if (err) console.error('posts.controller.js::postToAPI - loadContext getUserStarPost err', err)
          //console.log('posts.controller.js::postToAPI -  getUserStarPost got', res)
          starDone = true
          //repostDone=true
          data.you_starred = false // needs to be defined (if token only?)
          if (res && res.id) data.you_starred = true
          checkDone()
        })
        //console.log('is this post', data.id, 'by', tokenObj.userid)

        // what if this isn't repost but we did retweet
        ref.cache.getUserRepostPost(tokenObj.userid, post.id, function(err, res) {
          if (err) console.error('posts.controller.js::postToAPI - loadContext getUserRepostPost err', err)
          //console.log('posts.controller.js::postToAPI:::loadContext -', post.id, 'hasRepost', res.id)
          data.you_reposted = false
          if (res && res.id) {
            //console.log(post.id, 'not a repost but look up says ', tokenObj.userid, 'has reposted as', res.id)
            data.you_reposted = true
          }
          repostPostDone = true
          checkDone()
        })

        // well we only need if this is a repost
        if (post.repost_of) {
          // we'll need to look at it
          ref.cache.getUserRepostPost(tokenObj.userid, post.thread_id, function(err, res) {
            if (err) console.error('posts.controller.js::postToAPI - loadContext repost getUserRepostPost err', err)
            //console.log('posts.controller.js::postToAPI:::loadContext -', post.id, 'isRepost', res.id)
            repostRepostDone = true
            data.you_reposted = false
            if (res && res.id) {
              //console.log(tokenObj.userid, 'has reposted', post.repost_of, 'as', res.id)
              data.you_reposted = true
            }
            checkDone()
          })
        } else {
          repostRepostDone = true
          checkDone()
        }

        //
      } else {
        cb()
      }
    }

    // post.client_id is string(32)
    //console.log('posts.controller.js::postToAPI - gotUser. post.client_id:', post.client_id)
    loadClient(post, function(clientErr, source, clientMeta) {
      data.source = source
      setDone('client')
    })
    //console.log('posts.controller.js::postToAPI - gotPost. post.userid:', post.userid)
    loadUser(post.userid, params, function(userErr, user, userMeta) {
      data.user = user
      setDone('user')
    })
    loadRepostOf(post, tokenObj, function(repostErr, repost, repostMeta) {
      if (repost) data.repost_of = repost
      setDone('repostOf')
    })
    loadAnnotation(post, function(notesErr, apiNotes, notesMeta) {
      data.annotations = apiNotes
      setDone('annotation')
    })
    // writes to data
    loadEntites(post, function() {
      setDone('entities')
    })
    // writes to repostRepostDone
    loadContext(post, tokenObj, function() {
      setDone('context')
    })

    // these are stored in the db
    //   num_stars
    //   num_reposts
    //   num_replies

    // we need post, entities, annotations
    // user, entities, annotations
    // and finally client
    // could dispatch all 3 of these in parallel
    // shouldAdd but can't no name/link data

    //console.log('posts.controller.js::postToAPI - is ref this?', ref)
  },
  // take a list of IDs and lookup posts
  idsToAPI: function(posts, params, callback, meta) {
    //console.log('posts.controller.js::idsToAPI(', posts.length, 'posts,...,...,', meta, ') - start')
    const ref = this
    // definitely need this system
    const apiposts = {}
    let counts = 0
    //var apiposts=[]
    //console.log('posts.controller.js::idsToAPI - posts', posts)
    if (posts && posts.length) {
      posts.map(function(current, idx, Arr) {
        // get the post in API foromat
        //console.log('posts.controller.js::idsToAPI - getting current', current)
        // params && params.tokenobj?params.tokenobj:null
        ref.getPost(current.id, params, function(err, post, postMeta) {
          if (post && post.text) {
            //apiposts.push(post)
            apiposts[post.id] = post
          } else {
            // reposts are an example of a post without text
            console.log('posts.controller.js::idsToAPI - no post or missing text', post, err, meta, current.id)
            // with counts we don't need to do this
            //posts.pop() // lower needed
          }
          counts++
          // join
          //console.log(apiposts.length+'/'+entities.length)
          //console.log(counts+'/'+posts.length)
          if (counts === posts.length) {
          //if (apiposts.length===posts.length) {
            //console.log('posts.controller.js::idsToAPI - finishing')
            const res = []
            for (const i in posts) {
              const id = posts[i].id
              if (apiposts[id]) {
                //console.log('final', id)
                res.push(apiposts[id])
              }
            }
            callback(err, res, meta)
            /*
            for(var i in apiposts) {
              var id=apiposts[i].id
              console.log('final', id)
            }
            callback(apiposts, null, meta)
            */
          }
        })
      }, ref)
    } else {
      // no entities
      // this can be normal, such as an explore feed that's being polled for since_id
      //console.log('posts.controller.js::idsToAPI - no posts')
      callback(null, [], meta)
    }
  },
  addRepost: function(postid, tokenObj, callback) {
    //console.log('posts.controller.js::addRepost - start', postid)
    const ref = this
    // if postid is a repost_of
    this.cache.getPost(postid, function(err, srcPost) {
      if (err) console.error('posts.controller.js::addRepost - getPost err', err)
      let originalPost = postid
      if (srcPost && srcPost.repost_of) {
        originalPost = srcPost.thread_id
      }
      ref.cache.addRepost(postid, originalPost, tokenObj, function(err, dbPost, meta) {
        if (err) console.error('posts.controller.js::addRepost - err', err)
        //console.log('posts.controller.js::addRepost - dbPost', dbPost)
        // postToAPI function(post, params, token, callback, meta) {
        ref.postToAPI(dbPost, {}, tokenObj, callback, meta)
      })
    })
  },
  delRepost: function(postid, tokenObj, callback) {
    const ref = this
    this.cache.delRepost(postid, tokenObj, function(err, success, meta) {
      if (err) console.error('posts.controller.js::delRepost - err', err)
      // postToAPI function(post, params, token, callback, meta) {
      ref.getPost(postid, { generalParams: { deleted: true } }, callback)
    })
  },
  /**
   * get single post from data access
   * @param {number} id - the new post object
   * @param {object} params - the options context
   * @param {metaCallback} callback - function to call after completion
   */
  // what params here?? all
  // we need to ignore any paging parameter, likely from the parent call
  getPost: function(id, params, callback) {
    // probably should just exception and backtrace
    if (callback === undefined) {
      console.log('posts.controller.js::getPost - callback undefined')
      return
    }
    if (id === undefined) {
      callback(null, 'posts.controller.js::getPost - id is undefined')
      return
    }
    if (params === undefined) {
      console.log('posts.controller.js::getPost - WARNING params is undefined')
    }
    const ref = this
    //console.log('posts.controller.js::getPost - getting id',id)
    this.cache.getPost(id, function(err, post, meta) {
      if (err) console.error('posts.controller.js::getPost - err', err)
      if (post) {
        //console.log('posts.controller.js::getPost - GotPost', post)
        //console.log('posts.controller.js::getPost - GotPost',post.id)
        //console.log('posts.controller.js::getPost - postToAPI params', params)
        ref.postToAPI(post, params, params && params.tokenobj ? params.tokenobj : null, callback, meta)
      } else {
        callback(new Error('posts.controller.js::getPost - post is not set!'), false, false)
      }
    })
  },
  // threadid or reply_to? reply_to for now
  getReplies: function(postid, params, token, callback) {
    const ref = this
    if (!postid || postid === 'undefined') {
      callback(new Error('empty postid'), [], postid)
      return
    }
    // userid can't be me without a token
    // userid could be a username though
    // FIXME: make sure postid is a number
    this.cache.getPost(postid, function(err, post) {
      if (!post || err) {
        callback(err, [])
        return
      }
      // probably should chain these
      // because stupid if we don't have all the replies
      //console.log('apiroot', downloader.apiroot)
      if (ref.downloader.apiroot !== 'NotSet') {
        ref.downloader.downloadThread(post.thread_id, token)
      }
      ref.cache.getReplies(post.thread_id, params, token, function(err, posts, meta) {
        if (err) console.error('getReplies', err)
        //console.log('posts.controller.js::getReplies - returned posts:', posts, 'meta', meta)
        // data is an array of entities
        const apiposts = {}; let postcounter = 0
        //console.log('posts.controller.js:getReplies - mapping '+posts.length)
        if (posts && posts.length) {
          posts.map(function(current, idx, Arr) {
            //console.log('posts.controller.js:getReplies - map postid: '+current.id)
            // get the post in API foromat
            ref.postToAPI(current, params, token, function(err, post, postmeta) {
              if (err) console.error('posts.controller.js::getReplies - postToAPI err', err)
              // can error out
              if (post) {
                apiposts[post.id] = post
              }
              // always increase counter
              postcounter++
              // join
              //console.log(apiposts.length+'/'+entities.length)
              if (postcounter === posts.length) {
                //console.log('posts.controller.js::getReplies - finishing')
                // need to restore original order
                const res = []
                for (const i in posts) {
                  if (posts[i]) {
                    res.push(apiposts[posts[i].id])
                  }
                }
                //console.log('posts.controller.js::getReplies - result ', res)
                callback(err, res, meta)
              }
            })
          }, ref)
        } else {
          // no posts which is fine
          //console.log('posts.controller.js:getReplies - no replies ')
          callback(err, [], meta)
        }
      })
    })
  },
  getMentions: function(userid, params, token, callback) {
    // userid can't be me without a token
    if (userid === 'me') {
      if (token && token.userid) {
        userid = token.userid
      } else {
        console.log('posts.controller.js:getMentions - me but token', token)
        callback(new Error("need token for 'me' user"), [])
        return
      }
    }
    const ref = this
    // is this blocking execution? yes, I think it is
    this.cache.getUser(userid, function(err, user) {
      if (err) {
        console.log('posts.controller.js::getMentions - getUser err', err)
      }
      if (user && user.following === 0) {
        if (ref.downloader.apiroot !== 'NotSet') {
          console.log('downloadMentions')
          ref.downloader.downloadMentions(userid, params, token)
          console.log('downloadMentions complete')
        }
      }
    })
    // userid could be a username though
    this.cache.getMentions(userid, params, function(err, entities, meta) {
      if (err) console.error('posts.controller.js::getMentions - err', err)
      // data is an array of entities
      const apiposts = {}
      let count = 0
      //console.log('posts.controller.js:getMentions - mapping', entities.length)
      if (entities && entities.length) {
        //for(var i in entities) {
        //console.log('i',entities[i].typeid)
        //}
        entities.map(function(current, idx, Arr) {
          // get the post in API foromat
          //console.log('getting post',current.typeid)
          ref.getPost(current.typeid, params, function(perr, post, pmeta) {
            if (perr) console.error('posts.controller.js::getMentions - getPost err', perr)
            //console.log('got post',post.id)
            apiposts[post.id] = post
            count++
            // join
            //console.log(count+'/'+entities.length,'post',post.id,'entity',current.id)
            if (count === entities.length) {
              //console.log('posts.controller.js::getMentions - finishing', meta)
              // restore order
              const nlist = []
              for (const i in entities) {
                nlist.push(apiposts[entities[i].typeid])
              }
              callback(err, nlist, meta)
            }
          })
        }, ref)
      } else {
        // no entities
        callback(err, [], meta)
      }
    })
  },
  /**
   * get range of posts from data access
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getGlobal: function(params, callback) {
    const ref = this
    //console.log('posts.controller.js::getGlobal - start')
    this.cache.getGlobal(params, function(err, posts, meta) {
      // meta is garbage
      // more yes or no
      //console.log('posts.controller.js::getGlobal - returned meta', meta)
      // data is an array of entities
      const apiposts = {}; let postcounter = 0
      //console.log('posts.controller.js:getGlobal - mapping', posts.length)
      if (posts.length) {
        posts.map(function(current, idx, Arr) {
          if (!current) {
            console.log('posts.controller.js:getGlobal - no post', idx)
            current = {} // needs to at least be an object
          }
          //console.log('posts.controller.js:getGlobal - map postid: '+current.id)
          //console.log('ref',ref,'this',this)
          // get the post in API foromat
          ref.postToAPI(current, params, params.tokenobj, function(err, post, postmeta) {
            if (err) console.err('posts.controller.js - postToAPI err', err)
            if (post && !post.user) {
              console.log('posts.controller.js:getGlobal - no user from postToAPI', post.user)
            }
            //console.log('posts.controller.js:getGlobal - post id check post postToAPI ',post.userid)
            // can error out
            if (post) {
              apiposts[post.id] = post
            }
            // always increase counter
            postcounter++
            // join
            //console.log(postcounter+'/'+posts.length)
            if (postcounter === posts.length) {
              //console.log('posts.controller.js::getGlobal - finishing')
              // need to restore original order
              const res = []
              for (const i in posts) {
                if (posts[i]) {
                  //console.log('id',posts[i].id,'id',apiposts[posts[i].id].id,'date',apiposts[posts[i].id].created_at)
                  res.push(apiposts[posts[i].id])
                }
              }
              //console.log('sending',res.length,'posts to dialect')
              //console.log('posts.controller.js::getGlobal - meta', meta)
              callback(err, res, meta)
            }
          })
        }, ref)
      } else {
        // no posts
        callback(err, [], meta)
      }
    })
  },
  /**
   * get explore streams
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getExplore: function(params, callback) {
    this.cache.getExplore(params, function(err, endpoints, meta) {
      if (err) console.error('posts.controller.js::getExplore - err', err)
      //console.log('posts.controller.js::getExplore - returned meta', meta)
      callback(null, endpoints, meta)
    })
  },
  getUserStream: function(user, params, tokenObj, callback) {
    const ref = this
    //console.log('posts.controller.js::getUserStream - ', user)
    this.normalizeUserID(user, tokenObj, function(err, userid) {
      if (err) console.error('posts.controller.js::getUserStream - normalizeUserID err', err)
      //console.log('posts.controller.js::getUserStream - got', userid)
      //console.log('posts.controller.js::getUserStream - apiroot', ref.downloader.apiroot)
      if (ref.downloader.apiroot !== 'NotSet') {
        ref.cache.getUser(userid, function(err, userdata, meta) {
          if (err) console.error('posts.controller.js::getUserStream - getUser err', err)
          ref.cache.getFollowing(user, {}, function(err, followings) {
            if (err) console.error('posts.controller.js::getUserStream - getFollowing err', err)
            if (!followings || !followings.length) {
              // Yer following no one
              console.log('posts.controller.js::getUserStream - likely we need to sync followers for', user, 'theyre following no-one')
              ref.downloader.downloadFollowing(user, tokenObj)
              return
            }
            console.log('posts.controller.js::getUserStream - user counts check', userdata.following, 'vs', followings.length)
            if (userdata.following === 0 || followings.length === 0 || userdata.following > followings.length) {
              console.log('posts.controller.js::getUserStream - likely we need to sync followers for', user)
              ref.downloader.downloadFollowing(user, tokenObj)
              // or maybe just the follow count needs to be ran...
            }
          })
        })
      }
      // ok actually build the stream
      if (params.pageParams.count === undefined) params.pageParams.count = 20
      if (params.pageParams.before_id === undefined) params.pageParams.before_id = -1 // -1 being the very end
      //const oldcount = params.count
      // but we want to make sure it's in the right direction
      // if count is positive, then the direction is older than the 20 oldest post after before_id
      //params.pageParams.count+=1 // add one at the end to check if there's more
      // before_id
      //console.log('posts.controller.js::getUserStream - count', params.count)
      ref.cache.getUserPostStream(userid, params, tokenObj, function(err, posts, meta) {
        // data is an array of entities
        const apiposts = {}; let postcounter = 0
        //if (posts) console.log('posts.controller.js:getUserStream - mapping '+posts.length)
        if (posts && posts.length) {
          //var min_id=posts[0].id+200,max_id=0
          posts.map(function(current, idx, Arr) {
            //console.log('posts.controller.js:getUserPosts - map postid: '+current.id)
            // get the post in API foromat
            ref.postToAPI(current, params, tokenObj, function(err, post, postmeta) {
              //min_id=Math.min(min_id,post.id)
              //max_id=Math.max(max_id,post.id)
              apiposts[post.id] = post
              postcounter++
              // join
              //console.log(postcounter+'/'+posts.length)
              // -1 because we asked for an extra
              // but is that extra in the front or back?
              // was -1 but if we're ++ here
              // on 1/1 you can't do 1/1-1
              if (postcounter === posts.length) {
                //console.log('posts.controller.js::getUserStream - finishing')
                /*
                var imeta={
                  code: 200,
                  min_id: min_id,
                  max_id: max_id,
                  // we can't just compare here
                  // get 20: is it 20 posts? or is there 21?
                  more: meta.more
                }
                */
                const res = []
                // well not all of them...
                for (const i in posts) {
                  // well not all of them...
                  if (apiposts[posts[i].id]) {
                    res.push(apiposts[posts[i].id])
                  }
                }
                //console.log('posts.controller::getUserStream - meta', meta)
                //console.log('imeta',imeta)
                callback(err, res, meta)
              }
            })
          }, ref)
        } else {
          // no posts
          callback(err, [], meta)
        }
      })
    })
  },
  getUnifiedStream: function(user, params, token, callback) {
    //console.log('posts.controller.js::getUnifiedStream', user)
    const ref = this
    this.cache.getUnifiedStream(user, params, function(err, posts, meta) {
      if (err) console.error('post.controllers.js::getUnifiedStream - getUnifiedStream err', err)
      // data is an array of entities
      const apiposts = {}; let postcounter = 0
      //console.log('posts.controller.js:getUserPosts - mapping '+posts.length)
      if (posts && posts.length) {
        posts.map(function(current, idx, Arr) {
          //console.log('posts.controller.js:getUserPosts - map postid: '+current.id)
          // get the post in API foromat
          ref.postToAPI(current, params, token, function(err, post, postmeta) {
            if (err) console.error('post.controllers.js::getUnifiedStream - postToAPI err', err)
            apiposts[post.id] = post
            postcounter++
            // join
            //console.log(apiposts.length+'/'+entities.length)
            if (postcounter === posts.length) {
              //console.log('posts.controller.js::getUserPosts - finishing')
              const res = []
              for (const i in posts) {
                res.push(apiposts[posts[i].id])
              }
              callback(err, res, meta)
            }
          })
        }, ref)
      } else {
        // no posts
        callback(err, [], meta)
      }
    })
    //console.log('posts.controller.js::getUnifiedStream - write me')
    //callback(null, null)
  },
  /**
   * get range of posts for user id userid from data access
   * @param {number} userid - the user id to get posts for
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getUserPosts: function(user, params, callback) {
    //console.log('posts.controller.js::getUserPosts - user:', user)
    const ref = this
    this.normalizeUserID(user, params.tokenobj, function(err, userid) {
      if (err) console.error('posts.controller.js::getUserPosts - normalize userid err', err, user)
      //console.log('posts.controller.js::getUserPosts - userid:', userid)
      ref.cache.getUserPosts(userid, params, function(err, posts, meta) {
        // data is an array of entities
        const apiposts = {}; let postcounter = 0
        //console.log('posts.controller.js:getUserPosts - mapping '+posts.length)
        if (posts && posts.length) {
          posts.map(function(current, idx, Arr) {
            //console.log('posts.controller.js:getUserPosts - map postid: '+current.id)
            // get the post in API foromat
            ref.postToAPI(current, params, params.tokenobj, function(err, post, postmeta) {
              // cache?? no
              apiposts[post.id] = post
              postcounter++
              // join
              //console.log(postcounter+'/'+posts.length)
              if (postcounter === posts.length) {
                //console.log('posts.controller.js::getUserPosts - finishing', posts)
                const res = []
                for (const i in posts) {
                  //console.log(i, 'posts.controller.js::getUserPosts - copying', posts[i].id)
                  res.push(apiposts[posts[i].id])
                }
                //console.log('posts.controller.js::getUserPosts - callingback', res.length, 'posts')
                callback(err, res, meta)
                /*
                var res={}
                var done=0
                for(var i in posts) {
                  var scope=function(i) {
                    apiposts[posts[i].id].annotations=[]
                    ref.getAnnotation('post', posts[i].id, function(notes, err, notemeta) {
                      for(var j in notes) {
                        var note=notes[j]
                        //console.log('got note', j, '#', note.type, '/', note.value, 'for', posts[i].id)
                        apiposts[posts[i].id].annotations.push({
                          type: note.type,
                          value: note.value,
                        })
                      }
                      //console.log('got notes', posts[i].annotations, 'for', posts[i].id)
                      res[posts[i].id]=apiposts[posts[i].id]
                      console.log('results', done, '==posts', posts.length)
                      console.log(i, 'post obj', posts[i])
                      done++
                      if (done==posts.length) {
                        var nRes=[]
                        for(var k in posts) {
                          nRes.push(res[posts[k].id])
                        }
                        callback(nRes, null, meta)
                      }
                    })
                  }(i)
                }
                */
              }
            })
          }, ref)
        } else {
          // no posts
          callback(err, [], meta)
        }
      })
    })
  },
  /**
   * get range of hashtagged posts from data access
   * @param {string} hashtag - the hashtag to get posts for
   * @param {object} params - the pagination context
   * @param {metaCallback} callback - function to call after completion
   */
  getHashtag: function(hashtag, params, callback) {
    const ref = this
    //console.log('posts.controller.js:getHashtag - start #'+hashtag)
    this.cache.getHashtagEntities(hashtag, params, function(err, entities, meta) {
      // data is an array of entities
      const apiposts = []
      //console.log('posts.controller.js:getHashtag - mapping '+entities.length)
      if (entities.length) {
        // this seems to preserve order
        entities.map(function(current, idx, Arr) {
          // get the post in API foromat
          ref.getPost(current.typeid, params && params.tokenobj ? { tokenobj: params.tokenobj } : null, function(err, post, meta) {
            apiposts.push(post)
            // join
            //console.log(apiposts.length+'/'+entities.length)
            if (apiposts.length === entities.length) {
              //console.log('posts.controller.js::getHashtag - finishing')
              callback(err, apiposts)
            }
          })
        }, ref)
      } else {
        // no entities
        callback(err, [], meta)
      }
    })
  },
  getExploreFeed: function(feed, params, callback) {
    //console.log('posts.controller.js::getExploreFeed(', feed, ',...,...) - start')
    const ref = this
    this.cache.getExploreFeed(feed, params, function(err, posts, meta) {
      if (err) console.error('posts.controller.js::getExploreFeed - err', err)
      //console.log('posts.controller.js::getExploreFeed - posts', posts.length)
      // definitely need this system
      ref.idsToAPI(posts, params, callback, meta)
      /*
      var apiposts={}
      var counts=0
      //var apiposts=[]
      if (posts.length) {
        posts.map(function(current, idx, Arr) {
          // get the post in API foromat
          //console.log('getting', current.id)
          // params && params.tokenobj?params.tokenobj:null
          ref.getPost(current.id, params, function(post, err, postMeta) {
            if (post && post.text) {
              //apiposts.push(post)
              apiposts[post.id]=post
            } else {
              // reposts are an example of a post without text
              console.log('posts.controller.js::getExploreFeed - no post or missing text', post, err, meta, current.id)
              posts.pop() // lower needed
            }
            counts++
            // join
            //console.log(apiposts.length+'/'+entities.length)
            if (counts===posts.length) {
            //if (apiposts.length===posts.length) {
              //console.log('posts.controller.js::getExploreFeed - finishing')
              var res=[]
              for(var i in posts) {
                var id=posts[i].id
                if (apiposts[id]) {
                  //console.log('final', id)
                  res.push(apiposts[id])
                }
              }
              callback(res, null, meta)
              //for(var i in apiposts) {
                //var id=apiposts[i].id
                //console.log('final', id)
              //}
              //callback(apiposts, null, meta)
            }
          })
        }, ref)
      } else {
        // no entities
        callback([], 'no posts for '+feed, meta)
      }
      */
    })
  },
  postSearch: function(query, params, tokenObj, callback) {
    const ref = this
    //console.log('posts.controller.js::postSearch - query', query)
    this.cache.searchPosts(query, params, function(err, users, meta) {
      //console.log('posts.controller.js::userSearch - got', users.length, 'users')
      if (!users.length) {
        callback(err, [], meta)
        return
      }
      const rPosts = []
      for (const i in users) {
        // postToAPI function(post, params, tokenObj, callback, meta) {
        ref.postToAPI(users[i], params, tokenObj, function(err, adnPostObj) {
          //console.log('posts.controller.js::userSearch - got', adnUserObj, 'for', users[i])
          rPosts.push(adnPostObj)
          if (rPosts.length === users.length) {
            //console.log('posts.controller.js::userSearch - final', rUsers)
            callback(err, rPosts, meta)
          }
        }, meta)
      }
    })
  }
}
