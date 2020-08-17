module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // token: required
    app.post(prefix + '/posts/marker', function(req, resp) {
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('streammarkers.routes.js::postPOSTSmarker - getUserClientByToken err', err)
        //console.log('usertoken', usertoken);
        if (usertoken == null) {
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
          return
        }
        //console.log('dialect.*.js::POSTpostsMarker', req.body);
        dispatcher.setStreamMarker(req.body.name, req.body.id, req.body.percentage, usertoken, req.apiParams, callbacks.dataCallback(resp))
      })
    })
  }
}
