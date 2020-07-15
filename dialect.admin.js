// offical_callback??
const sendresponse = (json, resp) => {
  const ts = new Date().getTime();
  const diff = ts-resp.start;
  if (diff > 1000) {
    // this could be to do the client's connection speed
    // how because we stop the clock before we send the response...
    console.log(`${resp.path} served in ${ts - resp.start}ms`);
  }
  if (json.meta && json.meta.code) {
    resp.status(json.meta.code);
  }
  if (resp.prettyPrint) {
    json=JSON.stringify(json,null,4);
  }
  //resp.set('Content-Type', 'text/javascript');
  resp.type('application/json');
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.send(json);
}

// FIXME verification of modKey

// not a global
let cache

module.exports=function(app, prefix) {
  //var dispatcher=app.dispatcher;
  // set cache based on dispatcher object
  cache = app.dispatcher.cache;

  // get listing
  app.get(prefix + '/:model', (req, res) => {
    const model = req.params.model;
    console.log('admin::list model', model);
    switch(model) {
      case 'channels':
        cache.searchChannels({}, req.apiParams, function(err, channels, meta) {
          const resObj={
            meta: meta,
            data: channels,
          }
          return sendresponse(resObj, res);
        })
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // get single record
  app.get(prefix + '/:model/:id', (req, res) => {
    const model = req.params.model;
    const id = req.params.id;
    console.log('admin::findOne model', model, 'id', id);
    switch(model) {
      case 'users':
        if (id[0] == '@') {
          cache.getUserID(id.substring(1), function(err, user, meta) {
            const resObj={
              meta: meta,
              data: user,
            }
            return sendresponse(resObj, res);
          });
        } else {
          cache.getUser(id, function(err, user, meta) {
            const resObj={
              meta: meta,
              data: user,
            }
            return sendresponse(resObj, res);
          });
        }
      break;
      case 'tokens':
        // look up by token string
        if (id[0] == '@') {
          cache.getAPITokenByUsername(id.substring(1), function(err, usertoken, meta) {
            if (err) console.error('dialect.admin.js::getAPITokenByUsername - err', err)
            const resObj={
              meta: meta,
              data: usertoken,
            }
            return sendresponse(resObj, res);
          });
        } else {
          cache.getAPIUserToken(id, function(err, usertoken, meta) {
            if (err) console.error('dialect.admin.js::getAPIUserToken - err', err)
            const resObj={
              meta: meta,
              data: usertoken,
            }
            return sendresponse(resObj, res);
          });
        }
      break;
      case 'channels':
        cache.getChannel(id, req.apiParams, function(err, channel, meta) {
          const resObj={
            meta: meta,
            data: channel,
          }
          return sendresponse(resObj, res);
        });
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // get deletion list
  app.get(prefix + '/channels/:cid/interactions', (req, res) => {
    const cid = req.params.cid;
    //console.log('loading channel', cid);
    cache.getChannelDeletions(cid, req.apiParams, function(err, interactions, meta) {
      if (err) {
        console.error('getChannelDeletions err', err);
        const resObj={
          meta: {
            code: 500,
            error_message: err
          }
        };
        return sendresponse(resObj, res);
      }
      const resObj={
        meta: meta,
        data: interactions,
      }
      return sendresponse(resObj, res);
    });
  });

  // get message record
  app.get(prefix + '/channels/:cid/messages/:mid', (req, res) => {
    const cid = req.params.cid;
    const mid = req.params.mid;
    //console.log('admin::get message id', mid);
    cache.getMessage(mid, function(err, message, meta) {
      if (err) {
        console.error('getMessage err', err);
        const resObj={
          meta: {
            code: 500,
            error_message: err
          }
        };
        return sendresponse(resObj, res);
      }
      const resObj={
        meta: meta,
        data: message,
      }
      return sendresponse(resObj, res);
    })
  });

  // nuke message record
  app.delete(prefix + '/channels/:cid/messages/:mid', (req, res) => {
    const cid = req.params.cid;
    const mid = req.params.mid;
    console.log('admin::delete message id', mid);
    // marks it is_deleted: 1
    cache.deleteMessage(mid, cid, function(err, message, meta) {
      if (err) {
        console.error('deleteMessage err', err);
        const resObj={
          meta: {
            code: 500,
            error_message: err
          }
        };
        return sendresponse(resObj, res);
      }
      const resObj={
        meta: meta,
        data: message,
      }
      return sendresponse(resObj, res);
    })
  });

  // create record
  app.post(prefix + '/:model', (req, res) => {
    const model = req.params.model;
    console.log('admin::create model', model);
    switch(model) {
      case 'users':
        // "password" (2nd) parameter is not saved/used
        cache.addUser(req.body.username, '', function(err, user, meta) {
          if (err) console.error('dialect.admin::POST /users err', err)
          const resObj={
            meta: meta,
            data: user,
          }
          return sendresponse(resObj, res);
        })
      break;
      case 'channels':
        cache.addChannel(req.body.userid, req.body.channel, function(err, chnl, meta) {
          const resObj={
            meta: meta,
            data: chnl,
          }
          return sendresponse(resObj, res);
        });
      break;
      case 'tokens':
        const tokenIn = req.body;
        //console.log('creating token', tokenIn);
        if (tokenIn.expireInMins !== undefined && tokenIn.token) {
          cache.addUnconstrainedAPIUserToken(tokenIn.user_id, tokenIn.client_id, tokenIn.scopes, tokenIn.token, tokenIn.expireInMins, function(err, token, meta) {
            if (err) console.log('dialect.admin.js::POSTtokensExpire - addUnconstrainedAPIUserToken err', err)
            const resObj={
              meta: meta,
              data: token,
            }
            return sendresponse(resObj, res);
          });
        } else {
          cache.createOrFindUserToken(tokenIn.user_id, tokenIn.client_id, tokenIn.scopes, function(err, usertoken, meta) {
            if (err) console.log('dialect.admin.js::POSTtokensUnique - createOrFindUserToken err', err)
            const resObj={
              meta: meta,
              data: usertoken,
            }
            return sendresponse(resObj, res);
          });
        }
      break;
      case 'annotations':
        cache.addAnnotation(req.body.idtype, req.body.id, req.body.type, req.body.value, function(err, note, meta) {
          const resObj={
            meta: meta,
            data: note,
          }
          return sendresponse(resObj, res);
        });
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // update some fields
  app.patch(prefix + '/:model/:id', (req, res) => {
    const model = req.params.model;
    const id = req.params.id;
    console.log('admin::update model', model, 'id', id);
    switch(model) {
      case 'channels':
        cache.getChannel(id, req.apiParams, function(err, channel, meta) {
          // FIXME: WRITE ME
          const resObj={
            meta: meta,
            data: channel,
          }
          return sendresponse(resObj, res);
        })
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  });

  // set is_deleted=1
  app.delete(prefix + '/:model/:id', (req, res) => {
    const model = req.params.model;
    const id = req.params.id;
    console.log('admin::delete model', model, 'id', id);
    switch(model) {
      case 'tokens':
        cache.delAPIUserToken(id, function(err, delToken) {
          const resObj={
            meta: {
              code: 200,
            },
            data: delToken,
          }
          return sendresponse(resObj, res);
        });
      break;
      default:
        res.status(200).end("{}");
      break;
    }
  })
}
