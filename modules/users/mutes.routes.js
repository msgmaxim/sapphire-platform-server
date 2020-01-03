module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // Token: Any, Scope: no specified
    // app tokens can use user_id query to specify which users
    app.get(prefix+'/users/:user_id/muted', function(req, resp) {
      // req.token
      // req.token convert into userid/sourceid
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken', usertoken);
        if (usertoken==null) {
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          dispatcher.getMutes(req.params.user_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
        }
      });
    });

    app.post(prefix+'/users/:user_id/mute', function(req, resp) {
      // req.token
      // req.token convert into userid/sourceid
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken', usertoken);
        if (usertoken==null) {
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          dispatcher.addMute(req.params.user_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
        }
      });
    });


    app.delete(prefix+'/users/:user_id/mute', function(req, resp) {
      // req.token
      // req.token convert into userid/sourceid
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('usertoken', usertoken);
        if (usertoken==null) {
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          dispatcher.deleteMute(req.params.user_id, req.apiParams, usertoken, callbacks.dataCallback(resp));
        }
      });
    });
  }
}
