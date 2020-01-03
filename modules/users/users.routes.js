// for avatar support
const request=require('request')
const multer  = require('multer')
const storage = multer.memoryStorage()
const upload = multer({ storage: storage, limits: {fileSize: 100*1024*1024} })

let callbacks

// won't work unless we mount users...
function formatuser(user, token) {
  if (user) {
    user.id = ''+user.id;
    user.username = ''+user.username; // 530 was cast as an int
    user.created_at = callbacks.ISODateString(user.created_at);
    if (!user.counts) {
      // usually caused by call user instead of users callback
      console.log('dialect.appdotnet_official.callback.js::formatuser - no user counts object')
      user.counts={}
    }
    user.counts.following = parseInt(0+user.counts.following);
    user.counts.posts = parseInt(0+user.counts.posts);
    user.counts.followers = parseInt(0+user.counts.followers);
    user.counts.stars = parseInt(0+user.counts.stars);
    if (user.name) {
      user.name = ''+user.name;
    }
    if (token) {
      // boolean (and what about the non-existent state?)
      user.follows_you = user.follows_you?true:false;
      user.you_blocked = user.you_blocked?true:false;
      user.you_follow = user.you_follow?true:false;
      user.you_muted = user.you_muted?true:false;
      user.you_can_subscribe = user.you_can_subscribe?true:false;
      user.you_can_follow = user.you_can_follow?true:true;
    }
  }
  return user;
}

module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    callbacks = app.callbacks
    const ref = this

    // Token: Any, Scope: none in the docs
    app.get(prefix+'/users/search', function(req, resp) {
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
          // q or query?
          dispatcher.userSearch(req.query.q, req.apiParams, usertoken, ref.usersCallback(resp, req.token));
        }
      });
    });
    // no token
    // retreive multiple users (Token: any)
    // /reference/resources/user/lookup/#retrieve-multiple-users
    // ids are usually numeric but also can be @username
    app.get(prefix+'/users', function(req, resp) {
      if (!req.token) {
        var ids = req.query.ids
        if (ids && ids.match(/,/)) {
          ids = ids.split(/,/)
        }
        if (typeof(ids) === 'string') {
          ids = [ ids ];
        }
        //console.log('dialect.appdotnet_official.js:GETusers/ID - ids', ids)
        dispatcher.getUsers(ids, req.apiParams, ref.usersCallback(resp));
        return;
      }
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID - ', usertoken);
        if (usertoken!=null) {
          //console.log('dialect.appdotnet_official.js:GETusers/ID - found a token');
          req.apiParams.tokenobj=usertoken;
        }
        if (!req.query.ids) {
          var res={
            "meta": {
              "code": 400,
              "error_message": "Call requires and id to lookup"
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
          return;
        }
        dispatcher.getUsers(req.query.ids.split(/,/), req.apiParams, ref.usersCallback(resp));
      });
    });
    // no token
    app.get(prefix+'/users/:user_id', function(req, resp) {
      //console.log('dialect.appdotnet_official.js:GETusersX - token', req.token);
      if (!req.token) {
        dispatcher.getUser(req.params.user_id, req.apiParams, callbacks.dataCallback(resp));
        return;
      }
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:GETusers/ID - ', usertoken);
        if (usertoken!=null) {
          //console.log('dialect.appdotnet_official.js:GETusers/ID - found a token');
          req.apiParams.tokenobj=usertoken;
        }
        dispatcher.getUser(req.params.user_id, req.apiParams, ref.userCallback(resp));
      });
    });

    // Token: User Scope: update_profile
    app.put(prefix+'/users/me', function updateUser(req, resp) {
      //console.log('dialect.appdotnet_official.js:PUTusersX - token', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:PUTusersX - usertoken', usertoken)
        if (usertoken===null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
          return;
        }
        req.apiParams.tokenobj=usertoken;
        //console.log('dialect.appdotnet_official.js:PUTusersXx - body', req.body);
        //console.log('dialect.appdotnet_official.js:PUTusersX - creating channel of type', req.body.type);
        if (req.body.name === undefined || req.body.locale  === undefined ||
          req.body.timezone  === undefined || req.body.description === undefined ||
          req.body.description.text === undefined) {
          var res={
            "meta": {
              "code": 400,
              "error_message": "Requires name, locale, timezone, and description to change (JSON encoded)"
            }
          };
          resp.status(400).type('application/json').send(JSON.stringify(res));
          return;
        }
        //console.log('dialect.appdotnet_official.js:PUTusersXx - description.text', req.body.description.text)
        // user param to load everything
        //console.log('dialect.appdotnet_official.js:PUTusersXx - userid', usertoken.userid)
        dispatcher.getUser(usertoken.userid, { generalParams: { annotations: true, include_html: true } }, function(userObj, err) {
          // These are required fields
          /*
          var userobj={
            name: req.body.name,
            locale: req.body.locale,
            timezone: req.body.timezone,
            description: {
              text: req.body.description.text,
            },
          };
          */
          userObj.name = req.body.name;
          userObj.locale = req.body.locale;
          userObj.timezone = req.body.timezone;
          if (userObj.description === undefined) userObj.description = {}
          userObj.description.text = req.body.description.text;
          // optional fields
          if (req.body.annotations) {
            // spec says we need to add/update (delete if set/blank)
            // actually there'll be a type but no value
            // deletes / preprocess
            for(var i in req.body.annotations) {
              var note = req.body.annotations[i]
              if (note.type && note.value === undefined) {
                console.warn('dialect.appdotnet_official.js:PUTusersXx - need to delete', note.type);
                req.body.annotations.splice(i, 1)
              }
            }
            userObj.annotations = req.body.annotations;
          }
          //userObj.id = usertoken.userid;
          //console.log('dialect.appdotnet_official.js:PUTusersXx - userobj', userObj);
          dispatcher.updateUser(userObj, Date.now()/1000, callbacks.dataCallback(resp));
        });
        //dispatcher.addChannel(channel, req.apiParams, usertoken, callbacks.dataCallback(resp));
      });
    });

    app.post(prefix+'/users/me/avatar', upload.single('avatar'), function updateUserAvatar(req, resp) {
      if (!req.file) {
        // no files uploaded
        var res={
          "meta": {
            "code": 400,
            "error_message": "No file uploaded"
          }
        };
        resp.status(400).type('application/json').send(JSON.stringify(res));
        return;
      }
      console.log('POSTavatar - file upload got', req.file.buffer.length, 'bytes');
      if (!req.file.buffer.length) {
        // no files uploaded
        var res={
          "meta": {
            "code": 400,
            "error_message": "No file uploaded"
          }
        };
        resp.status(400).type('application/json').send(JSON.stringify(res));
        return;
      }
      //console.log('looking for type - params:', req.params, 'body:', req.body);
      // type is in req.body.type
      //console.log('POSTfiles - req token', req.token);
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        if (err) {
          console.log('dialect.appdotnet_official.js:POSTavatar - token err', err);
        }
        if (usertoken==null) {
          console.log('dialect.appdotnet_official.js:POSTavatar - no token');
          // could be they didn't log in through a server restart
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          return resp.status(401).type('application/json').send(JSON.stringify(res));
        }
        //console.log('dialect.appdotnet_official.js:POSTavatar - usertoken', usertoken);
        //console.log('dialect.appdotnet_official.js:POSTavatar - uploading to pomf');
        var uploadUrl = dispatcher.appConfig.provider_url;
        request.post({
          url: uploadUrl,
          formData: {
            //files: fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'),
            'files[]': {
              value: req.file.buffer,
              options: {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                knownLength: req.file.buffer.length
              },
            }
          }
        }, function (err, uploadResp, body) {
          if (err) {
            console.log('dialect.appdotnet_official.js:POSTavatar - pomf upload Error!', err);
            var res={
              "meta": {
                "code": 500,
                "error_message": "Could not save file (Could not POST to POMF)"
              }
            };
            resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
            return;
          }
          //console.log('URL: ' + body);
          /*
          {"success":true,"files":[
            {
              // lolisafe doesn't have hash
              //"hash":"107df9aadaf6204789f966e1b7fcd31d75a121c1",
              "name":"mysql.png",
              "url":"https:\/\/my.pomf.cat\/yusguk.png",
              "size":13357
            }
          ]}
          {
            success: false,
            errorcode: 400,
            description: 'No input file(s)'
          }
          */
          var data = {};
          try {
            data=JSON.parse(body);
          } catch(e) {
            console.log('couldnt json parse body', body);
            var res={
              "meta": {
                "code": 500,
                "error_message": "Could not save file (POMF did not return JSON as requested)"
              }
            };
            resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
            return;
          }
          if (!data.success) {
            var res={
              "meta": {
                "code": 500,
                "error_message": "Could not save file (POMF did not return success)"
              }
            };
            resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
            return;
          }
          //, 'from', body
          if (!data.files.length) {
            var res={
              "meta": {
                "code": 500,
                "error_message": "Could not save file (POMF did not return files)"
              }
            };
            resp.status(res.meta.code).type('application/json').send(JSON.stringify(res));
            return;
          }
          if (data.files.length > 1) {
            console.warn('dialect.appdotnet_official.js:POSTavatar - Multiple files!', data);
          }
          //for(var i in data.files) {
          var file=data.files[0];
          //console.log('dialect.appdotnet_official.js:POSTavatar - setting', file.url);
          dispatcher.updateUserAvatar(file.url, req.apiParams, usertoken, callbacks.userCallback(resp, req.token));
          //}
        });
      });
    });

    // partially update a user (Token: User Scope: update_profile)
    app.patch(prefix+'/users/me', function updateUser(req, resp) {
      //console.log('dialect.appdotnet_official.js:PATCHusersX - token', req.token)
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        //console.log('dialect.appdotnet_official.js:PATCHusersX - usertoken', usertoken)
        if (usertoken===null) {
          var res={
            "meta": {
              "code": 401,
              "error_message": "Call requires authentication: Authentication required to fetch token."
            }
          };
          resp.status(401).type('application/json').send(JSON.stringify(res));
          return;
        }
        req.apiParams.tokenobj=usertoken;
        //console.log('dialect.appdotnet_official.js:PATCHusersX - bodyType['+req.body+']');
        //console.log('dialect.appdotnet_official.js:PATCHusersX - body ', req.body);
        //var bodyObj = JSON.parse(req.body)
        var bodyObj = req.body
        /*
        for(var i in req.body) {
          console.log('dialect.appdotnet_official.js:PATCHusersX -', i, '=', req.body[i]);
        }
        */
        //console.log('dialect.appdotnet_official.js:PATCHusersX - test', req.body.annotations);
        var request={
          //name: req.body.name,
          //locale: req.body.locale,
          //timezone: req.body.timezone,
          //description: req.body.description,
        }
        if (bodyObj.name) {
          request.name = bodyObj.name
        }
        if (bodyObj.locale) {
          request.locale = bodyObj.locale
        }
        if (bodyObj.timezone) {
          request.timezone = bodyObj.timezone
        }
        if (bodyObj.description) {
          request.description = bodyObj.description
        }
        // optional fields
        if (req.body.annotations) {
          request.annotations = req.body.annotations;
        }
        //console.log('dialect.appdotnet_official.js:PATCHusersX - request', request);
        //console.log('dialect.appdotnet_official.js:PATCHusersX - creating channel of type', req.body.type);
        dispatcher.patchUser(request, req.apiParams, usertoken, callbacks.dataCallback(resp));
      });
    });

  },
  formatuser: formatuser,
  usersCallback: function(resp, token) {
    return function(unformattedUsers, err, meta) {
      var users=[];
      for(var i in unformattedUsers) {
        // filter out nulls, it's convenient to filter here
        if (formatuser(unformattedUsers[i])) {
          users.push(formatuser(unformattedUsers[i], token));
        }
      }
      // meta order: min_id, code, max_id, more
      var res={
        meta: meta,
        data: users
      };
      //console.log('ADNO.CB::usersCallback - res', res);
      callbacks.sendObject(res, resp);
    }
  },
  userCallback: function(resp, token) {
    return function(user, err, meta) {
      // meta order: min_id, code, max_id, more
      if (!user) {
        user={
          id: 0,
          username: 'notfound',
          created_at: '2014-10-24T17:04:48Z',
          avatar_image: {
            url: 'http://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
          },
          cover_image: {
            url: 'http://cdn.discordapp.com/icons/235920083535265794/a0f48aa4e45d17d1183a563b20e15a54.png'
          },
          counts: {
            following: 0,
          }
        };
      }
      var res={
        meta: meta,
        data: formatuser(user, token)
      };
      callbacks.sendObject(res, resp);
    }
  },
}
