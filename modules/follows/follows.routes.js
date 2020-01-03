const userRoutes = require('../users/users.routes')

module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    function followHandler(req, resp) {
      // can also be @username
      var followsid=req.params.user_id
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken', usertoken)
        if (usertoken==null) {
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          //console.log('ADNO::users/ID/follow - user_id', followsid)
          // data.user.id, data.follows_user.id

          //console.log('ADNO::users/ID/follow - token user id', usertoken.userid, 'creating a follow for', followsid)
          dispatcher.setFollows({
            user: { id: usertoken.userid }, follows_user: { id: followsid },
          }, 0, 0, Date.now(), function() {
            dispatcher.getUser(followsid, req.apiParams, userRoutes.userCallback(resp, req.token))
          })
        }
      })
    }

    app.post(prefix+'/users/:user_id/follow', followHandler)
    app.put(prefix+'/users/:user_id/follow', followHandler)

    app.delete(prefix+'/users/:user_id/follow', function(req, resp) {
      // can also be @username
      var followsid=req.params.user_id
      //console.log('body', req.body)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken', usertoken)
        if (usertoken==null) {
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          // data.user.id, data.follows_user.id
          dispatcher.setFollows({
            user: { id: usertoken.userid }, follows_user: { id: followsid },
          }, true, 0, Date.now(), userRoutes.userCallback(resp, req.token))
        }
      })
    })

    app.get(prefix+'/users/:user_id/following', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (usertoken===null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        dispatcher.getFollowings(req.params.user_id, req.apiParams,
          usertoken, userRoutes.usersCallback(resp, req.token))
      })
      //var cb=callbacks.posts2usersCallback(resp, req.token)
      //cb(notimplemented, 'not implemented', { code: 200 })
    })
    app.get(prefix+'/users/:user_id/followers', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (usertoken===null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        dispatcher.getFollowers(req.params.user_id, req.apiParams,
          usertoken, userRoutes.usersCallback(resp, req.token))
      })
      //var cb=callbacks.posts2usersCallback(resp, req.token)
      //cb(notimplemented, 'not implemented', { code: 200 })
    })
  }
}
