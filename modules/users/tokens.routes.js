module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // token: required
    app.get(prefix + '/token', function(req, resp) {
      // req.token convert into userid/sourceid
      //console.log('dialect.*.js::/token  - looking up usertoken', req.token)
      if (req.token === null || req.token === undefined || req.token === '') {
        console.log('tokens.routes.js::/token - No token passed in')
        const res = {
          meta: {
            code: 401,
            error_message: 'Call requires authentication: Authentication required to fetch token.'
          }
        }
        resp.status(res.meta.code).type('application/json').send(JSON.stringify(res))
        return
      }

      // need to translate token...
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('tokens.routes.js::/token - getUserClientByToken err', err)
        //console.log('usertoken',usertoken)
        //console.log('dialect.*.js::/token  - got usertoken')
        if (usertoken == null) {
          console.log('tokens.routes.js::/token - Not a valid token', req.token)
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(res.meta.code).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('dialect.*.js::got token for /token { userid:',usertoken.userid,'client_id:',usertoken.client_id)
        // FIXME: pass params
        dispatcher.getToken(usertoken.userid, usertoken.client_id, req.apiParams, callbacks.tokenCallback(resp, req.token))
      })
    })
  }
}
