const userRoutes = require('../users/users.routes')

module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks
    const ratelimiter = app.ratelimiter

    // Token: Any
    app.get(prefix + '/posts/:post_id/replies', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getPOSTSxREPLIES - getUserClientByToken err', err)
        dispatcher.getReplies(req.params.post_id, req.apiParams, usertoken, callbacks.postsCallback(resp, req.token))
      })
    })

    app.post(prefix + '/posts', function(req, resp) {
      /*
      {
        reply_to: null,
        text: 'adsf',
        entities: {
          parse_links: true,
          parse_markdown_links: true,
          links: []
        }
      }
      */
      ratelimiter.rateLimit(1, 1, function() {
        //console.log('ADNO::POST/posts - params', req.body)
        const postdata = {
          text: req.body.text
        }
        if (req.body.reply_to) { // this is optional
          postdata.reply_to = req.body.reply_to
          //console.log('setting reply_to', postdata.reply_to)
        }
        if (req.body.entities) {
          postdata.entities = req.body.entities
        }
        if (req.body.annotations) {
          postdata.annotations = req.body.annotations
        }
        dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
          if (err) {
            console.error('ADNO::POST/posts - token err', err)
          }
          if (usertoken === null) {
            console.log('dialect.appdotnet_official.js:POST/posts - no token for', req.token)
            // could be they didn't log in through a server restart
            const res = {
              meta: {
                code: 401,
                error_message: 'Call requires authentication: Authentication required to fetch token.'
              }
            }
            resp.status(401).type('application/json').send(JSON.stringify(res))
          } else {
            //console.log('dialect.appdotnet_official.js:postsStream - usertoken', usertoken)
            // if we set here we don't really need to pass token
            postdata.userid = usertoken.userid
            postdata.client_id = usertoken.client_id
            //console.log('ADNO::POST/posts - postObject', postdata)
            dispatcher.addPost(postdata, usertoken, callbacks.postCallback(resp, req.token))
            ratelimiter.logRequest(1, 1)
          }
        })
      })
    })
    app.delete(prefix + '/posts/:post_id', function(req, resp) {
      // can also be @username
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getPOSTSx - getUserClientByToken err', err)
        if (usertoken === null) {
          console.log('dialect.appdotnet_official.js:DELETE/posts - no token')
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          return resp.status(401).type('application/json').send(JSON.stringify(res))
        }
        //console.log('ADNO::DELETEposts - params', req.params)
        if (!req.params.post_id) {
          const res = {
            meta: {
              code: 400,
              error_message: 'invalid id given'
            }
          }
          return resp.status(400).type('application/json').send(JSON.stringify(res))
        }
        dispatcher.delPost(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token))
      })
    })
    function repostHandler(req, resp) {
      // req.apiParams.tokenobj isn't set because IO
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::repostHandler - getUserClientByToken err', err)
        if (usertoken === null) {
          console.log('dialect.appdotnet_official.js:DELETE/posts/ID/star - no token')
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          dispatcher.addRepost(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token))
        }
      })
    }

    app.post(prefix + '/posts/:post_id/repost', repostHandler)
    app.put(prefix + '/posts/:post_id/repost', repostHandler)
    app.delete(prefix + '/posts/:post_id/repost', function(req, resp) {
      // req.apiParams.tokenobj isn't set because IO
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::deletePOSTSxREPOST - getUserClientByToken err', err)
        if (usertoken === null) {
          console.log('dialect.appdotnet_official.js:DELETE/posts/ID/star - no token')
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          dispatcher.delRepost(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token))
        }
      })
    })

    // {"meta":{"code":401,"error_message":"Call requires authentication: This resource requires authentication and no token was provided."}}
    app.get(prefix + '/posts/stream', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:postsStream - start', req.token)
      // don't we already handle this in the middleware
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getPOSTSstream - getUserClientByToken err', err)
        //console.log('usertoken',usertoken)
        if (usertoken === null) {
          console.log('dialect.appdotnet_official.js:postsStream - no token')
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          //console.log('dialect.appdotnet_official.js:postsStream - getUserStream', req.token)
          //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp))
          dispatcher.getUserStream(usertoken.userid, req.apiParams, usertoken,
            callbacks.postsCallback(resp, req.token))
        }
      })
    })

    // search for posts (Token: Any)
    app.get(prefix + '/posts/search', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:postsSearch - start', req.token)
      // don't we already handle this in the middleware
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getPOSTSsearch - getUserClientByToken err', err)
        //console.log('dialect.appdotnet_official.js:postsSearch - ',usertoken)
        if (usertoken === null) {
          //console.log('dialect.appdotnet_official.js:postsSearch - no token')
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          // q or query?
          dispatcher.postSearch(req.query.q, req.apiParams, usertoken, userRoutes.usersCallback(resp, req.token))
        }
      })
    })

    // /posts/stream/unified
    app.get(prefix + '/posts/stream/unified', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:postsStreamUnified - start', req.token)
      // why bother the message pump and DB if req.token is undefined
      if (req.token === undefined) {
        console.log('dialect.appdotnet_official.js:postsStreamUnified - token not set')
        // could be they didn't log in through a server restart
        const res = {
          meta: {
            code: 401,
            error_message: 'Call requires authentication: Authentication required to fetch token.'
          }
        }
        resp.status(401).type('application/json').send(JSON.stringify(res))
      } else {
        dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
          if (err) console.error('posts.routes.js::getPOSTSstreamUNIFIED - getUserClientByToken err', err)
          //console.log('usertoken',usertoken)
          if (usertoken === null) {
            console.log('dialect.appdotnet_official.js:postsStreamUnified - no token')
            // could be they didn't log in through a server restart
            const res = {
              meta: {
                code: 401,
                error_message: 'Call requires authentication: Authentication required to fetch token.'
              }
            }
            resp.status(401).type('application/json').send(JSON.stringify(res))
          } else {
            //console.log('dialect.appdotnet_official.js:postsStream - getUserStream', req.token)
            //dispatcher.getUserStream(usertoken.userid, req.apiParams.pageParams, req.token, callbacks.postsCallback(resp))
            dispatcher.getUnifiedStream(usertoken.userid, req.apiParams,
              req.token, callbacks.postsCallback(resp, req.token))
          }
        })
      }
    })
    app.get(prefix + '/users/:user_id/mentions', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getUSERSmentions - getUserClientByToken err', err)
        if (usertoken != null) {
          //console.log('dialect.appdotnet_official.js:GETchannels - found a token', usertoken)
          req.apiParams.tokenobj = usertoken
          //userid=usertoken.userid
        }
        dispatcher.getMentions(req.params.user_id, req.apiParams,
          req.apiParams.tokenobj, callbacks.postsCallback(resp, req.token))
      })
    })
    /*
    app.get(prefix+'/users/:user_id/stars', function(req, resp) {
      // do we need a token, do we have a token?
      //console.log('dialect.appdotnet_official.js:usersStars - token', req.apiParams.tokenobj)
      dispatcher.getUserStars(req.params.user_id, req.apiParams.pageParams, callbacks.postsCallback(resp, req.token))
    })
    */

    /*
     * No token endpoints
     */
    app.get(prefix + '/posts/:id', function(req, resp) {
      dispatcher.getPost(req.params.id, req.apiParams, callbacks.postCallback(resp, req.token))
    })

    app.get(prefix + '/users/:user_id/posts', function(req, resp) {
      // we need token for stars/context
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getUSERSxPOSTS - getUserClientByToken err', err)
        //console.log('usertoken', usertoken)
        if (usertoken != null) {
          req.apiParams.pageParams.tokenobj = usertoken
        }
        dispatcher.getUserPosts(req.params.user_id, req.apiParams, callbacks.postsCallback(resp, req.token))
      })
    })

    app.get(prefix + '/posts/tag/:hashtag', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getPOSTStagX - getUserClientByToken err', err)
        //console.log('dialect.appdotnet_official.js:GETpostsTAGhashtag - token', usertoken)
        if (usertoken != null) {
          //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - found a token')
          req.apiParams.tokenobj = usertoken
        }
        dispatcher.getHashtag(req.params.hashtag, req.apiParams, callbacks.dataCallback(resp))
      })
    })
    app.get(prefix + '/posts/stream/global', function(req, resp) {
      // why data instead of posts?
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('posts.routes.js::getPOSTSstreamGLOBAL - getUserClientByToken err', err)
        req.apiParams.tokenobj = usertoken
        dispatcher.getGlobal(req.apiParams, callbacks.postsCallback(resp, req.token))
      })
    })
    app.get(prefix + '/posts/stream/explore', function(req, resp) {
      dispatcher.getExplore(req.apiParams, callbacks.dataCallback(resp))
    })
    app.get(prefix + '/posts/stream/explore/:feed', function(req, resp) {
      // this is just a stub hack
      //dispatcher.getGlobal(req.apiParams.pageParams, callbacks.postsCallback(resp, req.token))
      // going to get usertoken...
      dispatcher.getExploreFeed(req.params.feed, req.apiParams, callbacks.postsCallback(resp, req.token))
      //var cb=callbacks.postsCallback(resp, req.token)
      //cb(notimplemented, 'not implemented', { code: 200 })
    })
  }
}
