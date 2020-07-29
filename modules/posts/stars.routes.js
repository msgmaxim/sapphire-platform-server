module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    app.get(prefix+'/users/:user_id/interactions', function(req, resp) {
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
          // This endpoint accepts the interaction_actions as a query string parameter whose value
          // is a comma separated list of actions you're interested in. For instance, if you're
          // only interested in repost and follow interactions you could request
          // users/me/interactions?interaction_actions=repost,follow.

          // I don't think we want to pass the full token
          // wut? why not?
          dispatcher.getInteractions(req.params.user_id, usertoken, req.apiParams, callbacks.dataCallback(resp));
        }
      });
    });


    function starHandler(req, resp) {
      // req.apiParams.tokenobj isn't set because IO
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (usertoken==null) {
          console.log('dialect.appdotnet_official.js:POST/posts/ID/star - no token');
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          //console.log('dialect.appdotnet_official.js:POST/posts/ID/star - usertoken', usertoken);
          dispatcher.addStar(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
        }
      });
    }
    app.post(prefix+'/posts/:post_id/star', starHandler);
    app.put(prefix+'/posts/:post_id/star', starHandler);
    app.delete(prefix+'/posts/:post_id/star', function(req, resp) {
      // req.apiParams.tokenobj isn't set because IO
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (usertoken==null) {
          console.log('dialect.appdotnet_official.js:DELETE/posts/ID/star - no token');
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
        } else {
          //console.log('dialect.appdotnet_official.js:POST/posts/ID/star - usertoken', usertoken);
          dispatcher.delStar(req.params.post_id, usertoken, callbacks.postCallback(resp, req.token));
        }
      });
    });

    // get a list of posts starred by a User
    app.get(prefix+'/users/:user_id/stars', function(req, resp) {
      //console.log('ADNO::usersStar');
      // we need token for stars/context
      //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - token', req.token);
      if (!req.token) {
        dispatcher.getUserStars(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
        return;
      }
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - ', usertoken);
        if (usertoken!=null) {
          //console.log('dialect.appdotnet_official.js:GETusers/ID/stars - found a token');
          req.apiParams.tokenobj=usertoken;
        }
        dispatcher.getUserStars(req.params.user_id, req.apiParams, callbacks.postsCallback(resp, req.token));
      });
    });

  }
}
