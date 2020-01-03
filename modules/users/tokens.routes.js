module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    // token: required
    app.get(prefix+'/token', function(req, resp) {
      // req.token convert into userid/sourceid
      //console.log('dialect.*.js::/token  - looking up usertoken', req.token);
      if (req.token!==null && req.token!==undefined && req.token!='') {
        // need to translate token...
        dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
          //console.log('usertoken',usertoken);
          //console.log('dialect.*.js::/token  - got usertoken');
          if (usertoken==null) {
            console.log('dialect.*.js::No valid token passed in to /token', req.token);
            var res={
              "meta": {
                "code": 401,
                "error_message": "Call requires authentication: Authentication required to fetch token."
              }
            };
            resp.status(401).type('application/json').send(JSON.stringify(res));
          } else {
            //console.log('dialect.*.js::got token for /token { userid:',usertoken.userid,'client_id:',usertoken.client_id);
            // FIXME: pass params
            dispatcher.getToken(usertoken.userid, usertoken.client_id, callbacks.tokenCallback(resp, req.token));
          }
        });
      } else {
        console.log('dialect.*.js::No token passed in to /token');
        var res={
          "meta": {
            "code": 401,
            "error_message": "Call requires authentication: Authentication required to fetch token."
          }
        };
        resp.status(401).type('application/json').send(JSON.stringify(res));
      }
    });
  }
}
