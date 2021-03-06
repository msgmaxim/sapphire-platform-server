// get request http library
const request = require('request')
const URLSearchParams = require('url').URLSearchParams // node 8.x backfill

const pathUtil = require('path')

// managed downloader (paging?)
const downloader = require(pathUtil.join(__dirname, '/../downloader.js'))
//var rateLimiter = require('./ratelimiter.js');

//FIXME: 429 handling
// I guess we need some type of throttling

// backwards compatibility to allow us to do the right thing
// this doesn't give us QoS but does allow us to say put in the background
// does defer to immediate IO
require('setimmediate')

// remove 5 connections to upstream at a time
// we definitely want to burst when we need it
// though should set some type of limit, like the max ADN resets
// for what time period though? one frequency?
require('http').globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity

let modKey = ''

function start(nconf) {
  /** @todo make count configureable, low latency=20count, aggressive cache=200count */
  modKey = nconf.get('admin:modKey')
  module.exports.apiroot = 'http://' + (nconf.get('web:listen') || '127.0.0.1') + ':' + (nconf.get('web:port') || 7070)
  module.exports.adminroot = 'http://' + (nconf.get('admin:listen') || '127.0.0.1') + ':' + (nconf.get('admin:port') || 3000)
}

// make a request to the server
// only really used for POST/DELETE
const serverRequest = async(endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const { params = {}, method, objBody } = options
    const url = `${module.exports.adminroot}/${endpoint}`
    if (params) {
      url.search = new URLSearchParams(params)
    }
    var requestOptions = {
      url: url
    }
    var headers = {
      Authorization: `Bearer ${modKey}`
    }
    if (method) {
      requestOptions.method = method
      proxywrites++
    }
    if (objBody) {
      headers['Content-Type'] = 'application/json'
      requestOptions.body = JSON.stringify(objBody)
    }
    requestOptions.headers = headers

    proxycalls++

    //result = await nodeFetch(url, fetchOptions || undefined);
    //console.log('making request', requestOptions);
    request(requestOptions, function(err, response, body) {
      console.log('serverRequest body', body)
      if (err) {
        console.error('serverRequest err', err)
        return reject(err)
      }
      try {
        var obj = {
          response: JSON.parse(body)
        }
        resolve(obj)
      } catch (e) {
        console.error('dataaccess.proxy-admin::serverRequest  - cant parse', body, e)
        reject(e)
      }
    })
  })
}

var proxycalls = 0
var proxywrites = 0
var lcalls = 0
// minutely status report
setInterval(function() {
  //var ts = new Date().getTime()
  process.stdout.write('\n')
  console.log(new Date(), 'data.proxy report ' + (proxycalls - lcalls) + ' proxy recent calls. ' + proxycalls + ' overall', proxywrites, 'writes')
  // just need a redis info call to pull memory and keys stats
  lcalls = proxycalls
}, 60 * 1000)

// so we either define behavior or pass it to next() (upstream)

// pass in proxy settings or just conf it?
module.exports = {
  next: false,
  name: 'proxy-admin',
  start: start,
  dispatcher: false,
  apiroot: '',
  adminroot: '',
  /*
   * users
   */
  addUser: async function(username, password, callback) {
    //console.trace('dataaccess.proxy-admin.js::addUser(', username, password, typeof(callback), ')');
    const newUserRes = await serverRequest('users', {
      method: 'POST',
      objBody: {
        username: username,
        password: password
      }
    })
    //console.log('dataaccess.proxy-admin.js::addUser callinback', newUserRes);
    callback(newUserRes.err, newUserRes.response && newUserRes.response.data)
  },
  setUser: function(iuser, ts, callback) {
    if (this.next) {
      this.next.setUser(iuser, ts, callback)
    }
  },
  delUser: function(userid, callback) {
    if (this.next) {
      this.next.delUser(userid, callback)
    }
  },
  getUserID: async function(username, callback) {
    if (!username) {
      callback(new Error('dataaccess.proxy-admin.js::getUserID() - username was not set'), false, false)
      return
    }
    /*
    const getUserIDRes = await serverRequest('users/@' + username)
    if (getUserIDRes.err) {
      return callback(getUserIDRes.err, false, false);
    }
    if (!getUserIDRes.response) {
      // try getting from next layer
      if (this.next) {
        this.next.getUserID(username, callback);
        return;
      }
    }
    // upload fresh proxy data back into dataSource
    this.dispatcher.updateUser(getUserIDRes.response.data, new Date().getTime(),function(user, err) {
      // FIXME: convert ADN to API
      callback(getUserIDRes.err, getUserIDRes.response.data);
    })
    */
    var ref = this
    console.log('dataaccess.proxy-admin.js:getUserID - proxying user @' + username, 'haveToken', !!module.exports.token)
    proxycalls++
    var qs = ''
    //console.log('we have token?', module.exports.token)
    if (module.exports.token) {
      qs = '?access_token=' + module.exports.token
    } else {
      // no token, loki requires one now, so we need to escalate up to the admin API
      const newUserRes = await serverRequest('users/@' + username, {
        method: 'GET'
      })
      var res = newUserRes.response
      ref.dispatcher.updateUser(res.data, Date.now(), function(err, user) {
        if (err) console.error('dataaccess.proxy-admin.js:getUserID - noToken updateUser err', err)
        callback(err, user, res.meta)
      })
      return
    }
    request.get({
      url: ref.apiroot + '/users/@' + username + qs
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        // upload fresh proxy data back into dataSource
        ref.dispatcher.updateUser(res.data, new Date().getTime(), function(err, user) {
          if (user === null & err === null) {
            if (this.next) {
              this.next.getUserID(username, callback)
              return
            }
          } else if (err) {
            console.log('dataccess.proxy-admin.js:getUserID - User get err: ', err)
          //} else {
            //console.log("User Updated");
          }
          // FIXME: convert ADN to API
          //console.log('getUserID result for', username, 'is', user);
          // finally return
          callback(err, user, res.meta)
        })
      } else {
        console.log('dataccess.proxy-admin.js:getUserID - request failure')
        console.log('error', e)
        console.log('statusCode', r && r.statusCode)
        console.log('body', body)
        callback(null, e, false)
      }
    })
  },
  // callback is user,err,meta
  getUser: async function(userid, callback) {
    if (userid === undefined) {
      callback(null, 'dataaccess.proxy-admin.js:getUser - userid is undefined')
      return
    }
    if (!userid) {
      callback(null, 'dataaccess.proxy-admin.js:getUser - userid isn\'t set')
      return
    }
    var ref = this
    console.log('dataaccess.proxy-admin.js:getUser - proxying user ' + userid, 'hasToken', !!module.exports.token)
    proxycalls++
    var qs = ''
    if (module.exports.token) {
      qs = '?access_token=' + module.exports.token
    } else {
      // no token, loki requires one now, so we need to escalate up to the admin API
      const getUserRes = await serverRequest('users/' + userid, {
        method: 'GET'
      })
      var res = getUserRes.response
      ref.dispatcher.updateUser(res.data, new Date().getTime(), function(user, err) {
        callback(user, err, res.meta)
      })
      return
    }

    request.get({
      url: ref.apiroot + '/users/' + userid + qs
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        //console.log('dataaccess.proxy-admin.js:getUser - got res', res);
        // upload fresh proxy data back into dataSource
        //console.log('dataccess.proxy-admin.js:getUser - writing to user db ',res.data.id);
        ref.dispatcher.updateUser(res.data, new Date().getTime(), function(err, user) {
          //console.log('dataccess.proxy-admin.js:getUser - proxy response received');
          if (user === false & err === false) {
            if (this.next) {
              this.next.getUser(userid, callback)
              return
            }
          } else if (err) {
            console.log('dataaccess.proxy-admin.js:getUser - User Update err: ', err)
          //} else {
            //console.log("User Updated");
          }
          // finally reutrn
          callback(err, user, res.meta)
        })
      } else {
        console.log('dataaccess.proxy-admin.js:getUser - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(e, false, false)
      }
    })
  },
  getUsers: function(userids, params, callback) {
    if (userids === undefined) {
      console.log('dataccess.proxy-admin.js:getUsers - userids is undefined')
      callback(new Error('dataccess.proxy-admin.js:getUsers - userids is undefined'), false)
      return
    }
    if (!userids) {
      console.log('dataccess.proxy-admin.js:getUsers - userids isn\'t set')
      callback(new Error('dataccess.proxy-admin.js:getUsers - userids isn\'t set'), false)
      return
    }
    var ref = this
    console.log('dataccess.proxy-admin.js:getUsers - proxying users ' + userids)
    proxycalls++
    request.get({
      url: ref.apiroot + '/users?ids=' + userids.join(',')
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        // upload fresh proxy data back into dataSource
        //console.log('dataccess.proxy-admin.js:getUser - writing to user db ',res.data.id);
        ref.dispatcher.updateUser(res.data, new Date().getTime(), function(users, err) {
          //console.log('dataccess.proxy-admin.js:getUsers - proxy response received');
          if (users === false & err === false) {
            if (this.next) {
              this.next.getUsers(userids, params, callback)
              return
            }
          } else if (err) {
            console.log('dataccess.proxy-admin.js:getUsers - User Update err: ', err)
          //} else {
            //console.log("User Updated");
          }
          // finally reutrn
          callback(err, users, res.meta)
        })
      } else {
        console.log('dataccess.proxy-admin.js:getUsers - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(e, false, false)
      }
    })
  },
  /*
   * local user token
   */
  // should we really pass token in? it's cleaner separation if we do
  // even though this is the only implemention of the abstraction
  addAPIUserToken: function(userid, client_id, scopes, token, callback) {
    if (this.next) {
      this.next.addAPIUserToken(userid, client_id, scopes, token, callback)
    }
  },
  delAPIUserToken: async function(token, callback) {
    const newTokenRes = await serverRequest(`tokens/${token}`, {
      method: 'DELETE'
    })
    callback(newTokenRes.response, newTokenRes.err)
    /*
    if (this.next) {
      this.next.delAPIUserToken(token, callback);
    }
    */
  },
  getAPIUserToken: function(token, callback) {
    if (token === undefined) {
      callback(new Error('dataaccess.proxy-admin.js::getAPIUserToken - token is undefined'), false)
      return
    }
    var ref = this
    const endpoint = '/tokens/' + token
    console.log('dataaccess.proxy-admin.js:getAPIUserToken - proxying', endpoint)
    proxycalls++
    request.get({
      url: ref.adminroot + endpoint
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        //console.log('token', token, 'result', res);
        for (var i in res.data) {
          var msg = res.data[i]
          ref.dispatcher.setMessage(msg)
        }
        callback(null, res.data, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getAPIUserToken - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(e, false, false)
      }
    })
  },
  addUnconstrainedAPIUserToken: async function(user_id, client_id, scopes, token, expireInMins, callback) {
    const newTokenRes = await serverRequest('tokens', {
      method: 'POST',
      objBody: {
        user_id: user_id,
        client_id: client_id,
        scopes: scopes,
        token: token,
        expireInMins: expireInMins
      }
    })
    callback(newTokenRes.err, newTokenRes.response)
  },
  createOrFindUserToken: async function(user_id, client_id, scopes, callback) {
    const newTokenRes = await serverRequest('tokens', {
      method: 'POST',
      objBody: {
        user_id: user_id,
        client_id: client_id,
        scopes: scopes
      }
    })
    callback(newTokenRes.err, newTokenRes.response.data)
  },
  getAPITokenByUsername: async function(username, callback) {
    const newTokenRes = await serverRequest(`tokens/@${username}`)
    //console.log('proxy-admin::getAPITokenByUsername - response', newTokenRes);
    callback(newTokenRes.err, newTokenRes.response.data)
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, upstreamUserId, callback) {
    if (this.next) {
      this.next.setUpstreamUserToken(userid, token, scopes, upstreamUserId, callback)
    }
  },
  /*
   * local clients
   */
  addLocalClient: function(userid, callback) {
    if (this.next) {
      this.next.addLocalClient(userid, callback)
    }
  },
  getLocalClient: function(client_id, callback) {
    if (this.next) {
      this.next.getLocalClient(client_id, callback)
    }
  },
  delLocalClient: function(client_id, callback) {
    if (this.next) {
      this.next.delLocalClient(client_id, callback)
    }
  },
  /*
   * clients
   */
  addSource: function(client_id, name, link, callback) {
    if (this.next) {
      this.next.addSource(client_id, name, link, callback)
    }
  },
  getClient: function(client_id, callback) {
    if (this.next) {
      this.next.getClient(client_id, callback)
    }
  },
  setSource: function(source, callback) {
    if (this.next) {
      this.next.setSource(source, callback)
    }
  },
  /* client (app) tokens */
  addAPIAppToken: function(client_id, token, request) {
    console.log('dataccess.proxy-admin.js::addAPIAppToken - write me!')
  },
  delAPIAppToken: function(client_id, token) {
    console.log('dataccess.proxy-admin.js::delAPIAppToken - write me!')
  },
  getAPIAppToken: function(client_id, token) {
    console.log('dataccess.proxy-admin.js::getAPIAppToken - write me!')
  },
  /* client upstream token */
  addUpstreamClientToken: function(token, scopes) {
    console.log('dataccess.proxy-admin.js::addUpstreamClientToken - write me!')
  },
  delUpstreamClientToken: function(token) {
    console.log('dataccess.proxy-admin.js::delUpstreamClientToken - write me!')
  },
  getUpstreamClientToken: function() {
    console.log('dataccess.proxy-admin.js::getUpstreamClientToken - write me!')
  },
  /** user stream */
  /** app stream */

  /**
   * posts
   */
  addPost: function(ipost, token, callback) {
    var ref = this
    proxywrites++
    proxycalls++
    var postdata = {
      text: ipost.text,
      reply_to: ipost.reply_to
    }
    if (ipost.entities) {
      postdata.entities = ipost.entities
    }
    if (ipost.annotations) {
      postdata.annotations = ipost.annotations
    }
    console.log('proxying post write')
    // Authorization: Bearer ?
    // or ?access_token=xxx...
    request.post({
      url: ref.apiroot + '/posts',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        // two modes, JSON is more comprehensive...
        //"Content-Type": "application/x-www-form-urlencoded"
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postdata)
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var data = JSON.parse(body)
        if (data.meta.code === 200) {
          //console.dir(data.data);
          console.log('post written to network as ' + data.data.id + ' as ' + data.data.user.id)
          // the response can be setPost'd
          // the current post isn't in API format
          // it's in ADN post
          //ipost.id=data.data.id // set it's generated id
          ref.dispatcher.setPost(data.data)
          // this will convert ADN to DB format, then we don't have to bug the dispatcher
          ref.dispatcher.apiToPost(data, data.meta, function(post, err) {
            //ref.setPost(post);
            // it's formatted as ADN format
            // callback needs to expect DB format...
            // mainly the created_at
            callback(null, data.data, data.meta)
          })
        } else {
          console.log('failure? ', data.meta)
          callback(e, false, false)
        }
      } else {
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(e, false, false)
      }
    })
    /*
    if (this.next) {
      this.next.addPost(ipost, token, callback);
    }
    */
  },
  setPost: function(ipost, callback) {
    if (this.next) {
      this.next.setPost(ipost, callback)
    }
  },
  addRepost: function(postid, originalPost, token, callback) {
    var ref = this
    console.log('proxying posts/repost ' + postid)
    proxywrites++
    proxycalls++
    request.post({
      url: ref.apiroot + '/posts/' + postid + '/repost',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var data = JSON.parse(body)
        if (data.meta.code === 200) {
          //console.dir(data.data);
          console.log('post repost written to network as ' + data.data.id + ' as ' + data.data.user.id)
          // the response can be setPost'd
          //ref.setPost(body);
          // it's formatted as ADN format
          // callback needs to expect DB format...
          // mainly the created_at
          callback(null, data.data, data.meta)
        } else {
          console.log('failure? ', data.meta)
          callback(e, false, false)
        }
      } else {
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(e, false, false)
      }
      /*
      if (this.next) {
        this.next.addRepost(postid, originalPost, token, callback);
      } else {
        console.log('dataaccess.base.js::addRepost - write me!');
        callback(null, null);
      }
      */
    })
  },
  delRepost: function(postid, token, callback) {
    var ref = this
    console.log('proxying posts/repost ' + postid)
    proxywrites++
    proxycalls++
    request.del({
      url: ref.apiroot + '/posts/' + postid + '/repost',
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var data = JSON.parse(body)
        if (data.meta.code === 200) {
          //console.dir(data.data);
          console.log('post unrepost written to network as ' + data.data.id + ' as ' + data.data.user.id)
          // the response can be setPost'd
          //ref.setPost(body);
          // it's formatted as ADN format
          // callback needs to expect DB format...
          // mainly the created_at
          callback(null, data.data, data.meta)
        } else {
          console.log('failure? ', data.meta)
          callback(e, false, data.meta)
        }
      } else {
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(e, false, false)
      }
      /*
      if (this.next) {
        this.next.addRepost(postid, token, callback);
      } else {
        console.log('dataaccess.base.js::delRepost - write me!');
        callback(null, null);
      }
      */
    })
  },
  getPost: function(id, callback) {
    if (id === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getPost - id is undefined')
      return
    }
    if (callback === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getPost - callback is undefined')
      return
    }
    var ref = this
    console.log('proxying post ' + id)
    proxycalls++
    request.get({
      url: ref.apiroot + '/posts/' + id
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        ref.dispatcher.setPost(res.data, function(post, err) {
          //console.log('dataccess.proxy-admin.js::getPost - setPost: '+post.id+' ['+id+'/'+res.data.id+'],'+err);
          if (post === null && err === null) {
            if (this.next) {
              this.next.getPost(id, callback)
            } else {
              callback(res.data, null, res.meta)
            }
          } else {
            callback(post, err, res.meta)
          }
        })
      } else {
        console.log('dataccess.proxy-admin.js:getPost - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getReposts: function(postid, params, token, callback) {
    var ref = this
    console.log('proxying posts reposts ' + postid)
    proxycalls++
    /*
    if (this.next) {
      this.next.getReposts(postid, params, callback);
    } else {
      console.log('dataaccess.proxy-admin.js::getReposts - write me!');
      callback(null, null);
    }
    */
    request.get({
      url: ref.apiroot + '/posts/' + postid + '/reposters?count=' + params.count,
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        //console.log('dataccess.proxy-admin.js::getReposts - data',res.data);
        for (var i in res.data) {
          var post = res.data[i]
          ref.dispatcher.setPost(post)
        }
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js::getReposts - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        /*
        error null
        statusCode 429
        body {"meta":{"code":429,"error_message":"Too many requests"}}
        error null
        statusCode 401
        body {"meta":{"code":401,"error_message":"Call requires authentication: Invalid token.","error_slug":"invalid-token"}}
        */
        if (e === null & r.statusCode === 401) {
          const result = JSON.parse(body)
          if (result.meta.error_slug === 'invalid-token') {
            console.log('dataaccess.proxy-admin.js::getReposts - bad token', token, 'is bad')
          }
        }
        callback(null, e, null)
      }
    })
  },
  getReplies: function(postid, params, token, callback) {
    var ref = this
    console.log('proxying posts replies ' + postid)
    proxycalls++
    /*
    request.post({
      url: ref.apiroot+'/posts',
      method: 'POST',
      headers: {
        "Authorization": "Bearer "+token,
        // two modes, JSON is more comprehensive...
        //"Content-Type": "application/x-www-form-urlencoded"
        "Content-Type": "application/json"
      },
      body: JSON.stringify(postdata)
    }, function(e, r, body) {
    */
    // 200 or +params.count?
    // depends if we're updating or serving a request
    // might as well go with params, that way the caller can be explicit
    // we don't always want or need all this information
    request.get({
      url: ref.apiroot + '/posts/' + postid + '/replies?count=' + params.count,
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        for (var i in res.data) {
          var post = res.data[i]
          ref.dispatcher.setPost(post)
        }
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getReplies - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        /*
        error null
        statusCode 401
        body {"meta":{"code":401,"error_message":"Call requires authentication: Invalid token.","error_slug":"invalid-token"}}
        */
        if (e === null & r.statusCode === 401) {
          const result = JSON.parse(body)
          if (result.meta.error_slug === 'invalid-token') {
            console.log('dataaccess.proxy-admin.js::getReplies - bad token', token, 'is bad')
          }
        }
        callback(null, e, null)
      }
    })
  },
  getUserStream: function(user, params, token, callback) {
    /*
    if (this.next) {
      this.next.getUserStream(user, params, token, callback);
      return;
    }
    */
    //console.log('dataaccess.proxy-admin.js::getUserStream - write me!');
    var ref = this
    var ts = new Date().getTime()
    proxycalls++
    console.log('proxying user posts stream ' + user)
    request.get({
      url: ref.apiroot + '/posts/stream',
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        console.log('user posts stream retrieved')
        // return data immediately
        // all posts are ADN format, we need to convert to semi-ADN format
        // shouldn't it be our internal format? yes as that's what expected
        // from all dataaccess calls...

        var dbposts = {}; var postcounter = 0; var usercounter = 0
        //console.log('dispatcher.js:getReplies - mapping '+posts.length);
        if (res.data && res.data.length) {
          res.data.map(function(current, idx, Arr) {
            // if we don't upload user objects then it'll proxy them when postToAPI is called
            ref.dispatcher.updateUser(current.user, ts, function(userobj, err) {
              usercounter++
              if (usercounter === res.data.length) {
                // still finishes after posts converted (sometimes)
                console.log('user posts user upload complete')
              }
            })
            // get the post in DB foromat
            ref.dispatcher.apiToPost(current, res.meta, function(post, err, meta) {
              // can error out
              if (post) {
                dbposts[post.id] = post
              }
              // always increase counter
              postcounter++
              // join
              //console.log(apiposts.length+'/'+entities.length);
              if (postcounter === res.data.length) {
                //console.log('dispatcher.js::getReplies - finishing');
                // need to restore original order
                var postsres = []
                for (var i in res.data) {
                  if (res.data[i]) {
                    postsres.push(dbposts[res.data[i].id])
                  }
                }
                //console.log('dispatcher.js::getReplies - result ',res);
                console.log('user posts converted (users updated), sending data')
                callback(postsres, null, res.meta)
              }
            })
          }, ref)
        } else {
          // no posts
          console.log('dispatcher.js:getReplies - no replies ')
          callback(new Error('no posts for replies'), [], res.meta)
        }

        /*
        for(var i in res.data) {
          res.data[i]=ref.dispatcher.apiToPost(res.data[i]);
          // if we don't upload user objects then it'll proxy them when postToAPI is called
          ref.dispatcher.updateUser(res.data[i].user, ts);
          //res.data[i].created_at=new Date(res.data[i].created_at);
          //res.data[i].user.created_at=new Date(res.data[i].user.created_at);
          //res.data[i].userid=res.data[i].user.id;
          // repost_of?
          //console.log('test',res.data[i].created_at);
        }
        */
        // low priority (makes the respone return so much faster, well sometimes?)
        setImmediate(function() {
          // save data we have into cache
          console.log('preping posts/follow upload')
          // dispatcher will fetch it in ADN API format
          ref.dispatcher.getUser(user, null, function(self, err) {
            //console.log('self',self);
            // post process after the fact
            for (var i in res.data) {
              var post = res.data[i]
              //console.log('test',post.created_at);
              //console.log('postuser',post.user.avatar_image);
              // is this mutating user? not likely
              ref.dispatcher.setPost(post)
              // could build a fake follow structure here to bridge gaps
              // since this is one of the few calls that implies follows
              // this isn't that important for now, lower priority it
              setImmediate(function() {
                var follow = {
                  follows_user: post.user,
                  user: self
                }
                // we could set ts to 0, since we don't know when they followed
                // but we need to stomp any deleted follows for this pair
                // not deleted, no id...
                //console.log('setFollow', follow.user.avatar_image, follow.follows_user.avatar_image);
                if (typeof (follow.follows_user.avatar_image.width) === 'undefined' || typeof (follow.user.avatar_image.width) === 'undefined') {
                  console.log('failure on ' + i)
                }
                ref.dispatcher.setFollows(follow, 0, 0, ts)
              })
            }
            console.log('uploaded scraps')
          })
        })
      } else {
        console.log('dataccess.proxy-admin.js:getUserStream - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
    downloader.dispatcher = ref.dispatcher
    downloader.downloadFollowing(user, token)
    /** @todo async processing needed, so we don't lock the API. This all could be sent to a background thread*/
    /*
    // after the fact processing
    // assuming this proxy trigger means we don't have any followers for user
    // let's get some users
    var downloadfollowers=function(start, ts, self) {
      console.log('proxying user '+user+' following before '+start);
      proxycalls++;
      var str='';
      if (start) {
        str+='&before_id='+start;
      }
      var startdelay=0;
      var startdelay2=0;
      var counter=0;
      // if we lower the count, we maybe more responsive...
      request.get({
        url: ref.apiroot+'/users/'+user+'/following?count=200'+str,
        headers: {
          "Authorization": "Bearer "+token,
        }
      }, function(e, r, body) {
        if (!e && r.statusCode === 200) {
          var res=JSON.parse(body);
          console.log('retrieved followings '+res.data.length);
          // post process
          // 200 setFollow subprocess takes a huge toll on node
          // really slows the whole thing down...
          // this can lock for more than 35s
          // and then events/triggers really pile up
          for(var i in res.data) {
            var follow={
              follows_user: res.data[i],
              user: self
            };
            //console.log('follow is ',follow);
            //ref.dispatcher.setPost(post);
            // ok, let's not spam our workers, we'll slowly deal out this work.
            // 100 is too slow on my machine
            // 200 is fine
            // at 150, we can sync 900 users & follows in under 60s
            // probably can be an issue if multiple users are calling this...
            // though at 150 starting to see hangs towards the end
            startdelay2+=200;
            var func2=function(follow) {
              // this put it high on the QoS list but delayed...
              // so we get some what of a medium priority (not current but not low)
              // doesn't the delay cancel whether it's high or low?
              // probably...
              setTimeout(function() {
                // if we can skip the self update, that may help performance
                ref.dispatcher.setFollows(follow, 0, 0, ts);
                counter++;
                if (counter==res.data.length) {
                  console.log('Following batch complete',counter);
                }
              }, startdelay2);
            };
            func2(follow);
            */
    /** @todo we need to track usage rate/limits on each token */
    // we could also queue up their last 20 posts too...
    // it's a little agressive, we have want we need for the user stream
    // burns through our token limits and puts unneeded stress on the network
    // well as long as we have an upstream we don't need this
    // even if we didn't, we'd have to poll global anyways to get all new posts efficently
    /*
            startdelay+=10*1000; // we get about 20 reads/minute
            // 10*200=over 20 minutes to d/l everything
            var userid=res.data[i].id;
            //console.log('at '+startdelay+'s get user\'s '+userid+' posts');
            // scope hacks...
            var func=function(userid) {
              setTimeout(function() {
                ref.getUserPosts(userid, null, function() {});
              }, startdelay);
            };
            func(userid);
            */
    /*
          }
          console.log('Processed all '+res.data.length+' followings');

          // dispatcher next io call asap
          // need to page results too...
          if (res.meta && res.meta.more) {
            // in 1s
            console.log('dataccess.proxy-admin.js::getUserStream - getting more followings',res.meta.min_id,res.meta.max_id);
            // in one second continue
            //setTimeout(function() {
            // should help the stack, right? we don't need to return any faster here
            // lets block until we're done
            // but it does yeild for a second
            // doesn't work like that in v10
            // we don't want to yeild, it's a high priority we get all these
            //setImmediate(function() {
              downloadfollowers(res.meta.min_id, ts, self);
            //});
            //}, 1000);
          } else {
            console.log('dataccess.proxy-admin.js::getUserStream - retrieved all followings',res.meta);
          }
        } else {
          console.log('dataccess.proxy-admin.js:getUserStream followings download - request failure');
          // e can be { [Error: socket hang up] code: 'ECONNRESET' }
          console.log('error');
          console.dir(e);
          if (r) {
            console.log('statusCode', r.statusCode);
          }
          console.log('body', body);
        }
      });
    }
    // background but at top of queue
    // so we get a tick of yeild in there, let's not starve other's requests
    // uhm there is no rush to download all the followers
    // we've already served the stream
    // ah but you can't update the stream until we know everyone that you're following
    // so there is a rush
    setTimeout(function() {
      ref.dispatcher.getUser(user, null, function(self, err) {
        //console.log('self',self);
        downloadfollowers(0, ts, self);
      });
    }, 0);
    //callback([], null);
    */
  },
  // user can be an id or @username
  getUnifiedStream: function(user, params, token, callback) {
    //console.log('dataaccess.proxy-admin.js::getUserStream - write me!');
    var ref = this
    var ts = new Date().getTime()
    proxycalls++
    console.log('proxying user posts stream ' + user)
    request.get({
      url: ref.apiroot + '/posts/stream',
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        console.log('user posts stream retrieved')
        // return data immediately
        // all posts are ADN format, we need to convert to semi-ADN format
        // shouldn't it be our internal format? yes as that's what expected
        // from all dataaccess calls...

        var dbposts = {}; var postcounter = 0; var usercounter = 0
        //console.log('dispatcher.js:getReplies - mapping '+posts.length);
        if (res.data && res.data.length) {
          res.data.map(function(current, idx, Arr) {
            // if we don't upload user objects then it'll proxy them when postToAPI is called
            ref.dispatcher.updateUser(current.user, ts, function(userobj, err) {
              usercounter++
              if (usercounter === res.data.length) {
                // still finishes after posts converted (sometimes)
                console.log('user posts user upload complete')
              }
            })
            // get the post in DB foromat
            ref.dispatcher.apiToPost(current, res.meta, function(post, err, meta) {
              // can error out
              if (post) {
                dbposts[post.id] = post
              }
              // always increase counter
              postcounter++
              // join
              //console.log(apiposts.length+'/'+entities.length);
              if (postcounter === res.data.length) {
                //console.log('dispatcher.js::getReplies - finishing');
                // need to restore original order
                var postsres = []
                for (var i in res.data) {
                  if (res.data[i]) {
                    postsres.push(dbposts[res.data[i].id])
                  }
                }
                //console.log('dispatcher.js::getReplies - result ',res);
                console.log('user posts converted (users updated), sending data')
                callback(null, postsres, res.meta)
              }
            })
          }, ref)
        } else {
          // no posts
          console.log('dispatcher.js:getReplies - no replies ')
          callback(new Error('no posts for replies'), [], res.meta)
        }

        /*
        for(var i in res.data) {
          res.data[i]=ref.dispatcher.apiToPost(res.data[i]);
          // if we don't upload user objects then it'll proxy them when postToAPI is called
          ref.dispatcher.updateUser(res.data[i].user, ts);
          //res.data[i].created_at=new Date(res.data[i].created_at);
          //res.data[i].user.created_at=new Date(res.data[i].user.created_at);
          //res.data[i].userid=res.data[i].user.id;
          // repost_of?
          //console.log('test',res.data[i].created_at);
        }
        */
        // low priority (makes the respone return so much faster, well sometimes?)
        setImmediate(function() {
          // save data we have into cache
          console.log('preping posts/follow upload')
          // dispatcher will fetch it in ADN API format
          ref.dispatcher.getUser(user, null, function(self, err) {
            //console.log('self',self);
            // post process after the fact
            for (var i in res.data) {
              var post = res.data[i]
              //console.log('test',post.created_at);
              //console.log('postuser',post.user.avatar_image);
              // is this mutating user? not likely
              ref.dispatcher.setPost(post)
              // could build a fake follow structure here to bridge gaps
              // since this is one of the few calls that implies follows
              // this isn't that important for now, lower priority it
              setImmediate(function() {
                var follow = {
                  follows_user: post.user,
                  user: self
                }
                // we could set ts to 0, since we don't know when they followed
                // but we need to stomp any deleted follows for this pair
                // not deleted, no id...
                //console.log('setFollow', follow.user.avatar_image, follow.follows_user.avatar_image);
                if (typeof (follow.follows_user.avatar_image.width) === 'undefined' || typeof (follow.user.avatar_image.width) === 'undefined') {
                  console.log('failure on ' + i)
                }
                ref.dispatcher.setFollows(follow, 0, 0, ts)
              })
            }
            console.log('uploaded scraps')
          })
        })
      } else {
        console.log('dataccess.proxy-admin.js:getUserStream - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getUserPosts: function(user, params, callback) {
    if (user === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getUserPosts - user is undefined')
      return
    }
    if (user === '') {
      callback(null, 'dataccess.proxy-admin.js::getUserPosts - user is empty')
      return
    }
    var ref = this
    console.log('proxying user posts ' + user)
    proxycalls++
    request.get({
      url: ref.apiroot + '/users/' + user + '/posts'
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        for (var i in res.data) {
          var post = res.data[i]
          ref.dispatcher.setPost(post)
        }
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getUserPosts - request failure')
        console.log('error', e)
        if (r) {
          console.log('statusCode', r.statusCode)
        }
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getMentions: function(user, params, token, callback) {
    //console.log('dataaccess.proxy-admin.js::getMentions - write me');
    var ref = this
    proxycalls++
    var querystring = ''
    if (params.count || params.since_id || params.before_id) {
      // convert to array/loop
      // 0 is ok, where's isset for JS?
      if (parseInt(params.count) !== 20) { // if not equal default
        querystring += '&count=' + params.count
      }
      if (params.since_id) {
        querystring += '&since_id=' + params.since_id
      }
      if (params.before_id) {
        querystring += '&before_id=' + params.before_id
      }
    }
    console.log('proxying global?' + querystring)
    request.get({
      url: ref.apiroot + '/users/' + user + '/mentions?' + querystring
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        //console.dir(res);
        for (var i in res.data) {
          var post = res.data[i]
          //console.log('Processing post '+post.id);
          ref.dispatcher.setPost(post)
        }
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getMentions - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getGlobal: function(params, callback) {
    //console.log('dataaccess.proxy-admin.js::getGlobal - write me');
    var ref = this
    proxycalls++
    var querystring = ''
    if (params.count || params.since_id || params.before_id) {
      // convert to array/loop
      // 0 is ok, where's isset for JS?
      if (parseInt(params.count) !== 20) { // if not equal default
        querystring += '&count=' + params.count
      }
      if (params.since_id) {
        querystring += '&since_id=' + params.since_id
      }
      if (params.before_id) {
        querystring += '&before_id=' + params.before_id
      }
    }
    console.log('proxying global?' + querystring)
    request.get({
      url: ref.apiroot + '/posts/stream/global?' + querystring
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        //console.dir(res);
        for (var i in res.data) {
          var post = res.data[i]
          //console.log('Processing post '+post.id);
          ref.dispatcher.setPost(post)
        }
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getGlobal - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getExplore: function(params, callback) {
    //console.log('dataaccess.proxy-admin.js::getGlobal - write me');
    var ref = this
    proxycalls++
    var querystring = ''
    if (params.count || params.since_id || params.before_id) {
      // convert to array/loop
      // 0 is ok, where's isset for JS?
      if (parseInt(params.count) !== 20) { // if not equal default
        querystring += '&count=' + params.count
      }
      if (params.since_id) {
        querystring += '&since_id=' + params.since_id
      }
      if (params.before_id) {
        querystring += '&before_id=' + params.before_id
      }
    }
    console.log('proxying explore?' + querystring + ' (? is querystring)')
    request.get({
      url: ref.apiroot + '/posts/stream/explore?' + querystring
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        // this can be undefined...
        console.log('status', r.statusCode, 'e', e, 'body', body)
        var res = JSON.parse(body)
        console.log('received explore')
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getExplore - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getExploreFeed: function(feed, params, callback) {
    //console.log('dataaccess.proxy-admin.js::getGlobal - write me');
    var ref = this
    proxycalls++
    var querystring = ''
    if (params.count || params.since_id || params.before_id) {
      // convert to array/loop
      // 0 is ok, where's isset for JS?
      if (parseInt(params.count) !== 20) { // if not equal default
        querystring += '&count=' + params.count
      }
      if (params.since_id) {
        querystring += '&since_id=' + params.since_id
      }
      if (params.before_id) {
        querystring += '&before_id=' + params.before_id
      }
    }
    console.log('proxying explore/' + feed + '?' + querystring)
    request.get({
      url: ref.apiroot + '/posts/stream/explore/' + feed + '?' + querystring
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        // this can be undefined...
        //console.log('status',r.statusCode,'e',e,'body',body);
        var res = JSON.parse(body)
        // in API format, no post
        callback(res.data, null, res.meta)
        //console.log('received explore');
        for (var i in res.data) {
          var post = res.data[i]
          //console.log('Processing post '+post.id);
          ref.dispatcher.setPost(post)
        }
      } else {
        console.log('dataccess.proxy-admin.js:getExplore - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  /** channels */
  addChannel: async function(userid, channel, callback) {
    //console.log('dataaccess.proxy-admin.js::addChannel - hit!');
    //console.trace('dataaccess.proxy-admin.js::addChannel(', userid, channel, ')');
    const newChnlRes = await serverRequest('channels', {
      method: 'POST',
      objBody: {
        userid: userid,
        channel: channel
      }
    })
    /*
    if (!newChnlRes.response || !newChnlRes.response.data) {
      if (this.next) {
        this.next.addChannel(userid, channel, callback);
      }
    }
    */

    //console.log('dataaccess.proxy-admin.js::addChannel callinback', newUserRes);
    callback(newChnlRes.response && newChnlRes.response.data, newChnlRes.err)
  },
  setChannel: function(chnl, ts, callback) {
    if (this.next) {
      this.next.setChannel(chnl, ts, callback)
    }
  },
  getChannel: function(id, params, callback) {
    if (id === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getChannel - id is undefined')
      return
    }
    var ref = this
    console.log('proxying channel ' + id)
    proxycalls++
    request.get({
      url: ref.apiroot + '/channels/' + id
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        var ts = new Date().getTime()
        ref.dispatcher.setChannel(res.data, ts, function(chnl, err) {
          if (chnl === null && err === null) {
            if (this.next) {
              this.next.getChannel(id, callback)
            } else {
              callback(res.data, null, res.meta)
            }
          } else {
            callback(chnl, err, res.meta)
          }
        })
      } else {
        console.log('dataccess.proxy-admin.js:getChannel - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  /** messages */
  setMessage: function(msg, callback) {
    if (this.next) {
      this.next.setMessage(msg, callback)
    }
  },
  addMessage: function(msg, callback) {
    if (this.next) {
      this.next.addMessage(msg, callback)
    } else {
      console.log('dataaccess.proxy-admin.js::addMessage - write me!')
      callback(null, null)
    }
  },
  deleteMessage: async function(message_id, channel_id, callback) {
    //console.log('proxy-admin::deleteMessage - ', message_id, channel_id);
    if (!message_id) {
      return callback(null, 'no messageid')
    }
    const deleteRes = await serverRequest(`channels/${channel_id}/messages/${message_id}`, {
      method: 'DELETE'
    })
    callback(deleteRes.err, deleteRes.response)
  },
  getMessage: function(id, callback) {
    if (id === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getMessage - id is undefined')
      return
    }
    var ref = this
    var idStr = id
    if (id instanceof Array) {
      idStr = id.join(',')
    }
    const endpoint = '/channels/messages?ids=' + idStr
    console.log('dataaccess.proxy-admin.js:getMessage - proxying', endpoint)
    proxycalls++
    request.get({
      url: ref.apiroot + endpoint
    }, function(e, r, body) {
      //console.log('body', body)
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        if (id instanceof Array) {
        } else {
          // single, drop array container
          res.data = res.data[0]
        }
        ref.dispatcher.setMessage(res.data, function(err, msg) {
          if (err) console.error('dataaccess.proxy-admin.js::getMessage - setMessage err', err)
          if (msg === null && err === null) {
            if (this.next) {
              this.next.getMessage(id, callback)
            }
          } else {
            // FIXME: convert back to db object...
            callback(err, msg, res.meta)
          }
        })
      } else {
        console.log('dataccess.proxy-admin.js:getMessage - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getChannelMessages: function(channelid, params, callback) {
    if (channelid === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getChannelMessages - channelid is undefined')
      return
    }
    var ref = this
    console.log('proxying messages in channel ' + channelid)
    proxycalls++
    request.get({
      url: ref.apiroot + '/channels/' + channelid + '/messages'
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        for (var i in res.data) {
          var msg = res.data[i]
          ref.dispatcher.setMessage(msg)
        }
        // FIXME: convert back to db object...
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getChannelMessages - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  getChannelDeletions: function(channel_id, params, callback) {
    if (channel_id === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getChannelDeletions - channel_id is undefined')
      return
    }
    var ref = this
    console.log('proxying interactions in channel ' + channel_id)
    proxycalls++
    request.get({
      url: ref.adminroot + '/channels/' + channel_id + '/interactions'
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        for (var i in res.data) {
          var msg = res.data[i]
          ref.dispatcher.setMessage(msg)
        }
        callback(res.data, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getChannelDeletions - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  /** subscription */
  /*
    channelid: { type: Number, index: true },
    userid: { type: Number, index: true },
    created_at: { type: Date, index: true },
    active: { type: Boolean, index: true },
    last_updated: { type: Date },
  */
  setSubscription: function(chnlid, userid, del, ts, callback) {
    if (this.next) {
      this.next.setSubscription(chnlid, userid, del, ts, callback)
    }
  },
  getUserSubscriptions: function(userid, params, callback) {
    if (userid === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getUserSubscriptions - userid is undefined')
      return
    }
    if (this.next) {
      this.next.getUserSubscriptions(userid, params, callback)
    }
  },
  getChannelSubscriptions: function(channelid, params, callback) {
    if (channelid === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getChannelSubscriptions - channelid is undefined')
      return
    }
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback)
    }
  },
  /** files */
  /** entities */
  // should this model more closely follow the annotation model?
  // not really because entities are immutable (on posts not users)
  extractEntities: function(type, id, entities, entitytype, callback) {
    if (this.next) {
      this.next.extractEntities(type, id, entities, entitytype, callback)
    }
  },
  getEntities: function(type, id, callback) {
    if (this.next) {
      this.next.getEntities(type, id, callback)
    } else {
      callback(null, null)
    }
  },
  getHashtagEntities: function(hashtag, params, callback) {
    if (hashtag === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getHashtagEntities - hashtag is undefined')
      return
    }
    if (hashtag === '') {
      callback(null, 'dataccess.proxy-admin.js::getHashtagEntities - hashtag is empty')
      return
    }
    var ref = this
    console.log('proxying hashtag posts ' + hashtag)
    proxycalls++
    request.get({
      url: ref.apiroot + '/posts/tag/' + hashtag
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var res = JSON.parse(body)
        var entries = []
        for (var i in res.data) {
          var post = res.data[i]
          ref.dispatcher.setPost(post)
          var entry = {
            idtype: 'post',
            typeid: post.id,
            type: 'hashtag',
            text: hashtag
          }
          entries.push(entry)
        }
        callback(entries, null, res.meta)
      } else {
        console.log('dataccess.proxy-admin.js:getHashtagEntities - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  },
  /**
   * Annotations
   */
  addAnnotation: async function(idtype, id, type, value, callback) {
    await serverRequest('annotations', {
      method: 'POST',
      objBody: {
        idtype: idtype,
        id: id,
        type: type,
        value: value
      }
    })
    // FIXME: do we need a next for writes?
    /*
    console.log('dataccess.proxy-admin.js::addAnnotation - write me!');
    if (this.next) {
      this.next.addAnnotation(idtype, id, type, value, callback);
    }
    */
  },
  clearAnnotations: function(idtype, id, callback) {
    //console.log('dataccess.proxy-admin.js::clearAnnotations - write me!');
    if (this.next) {
      this.next.clearAnnotations(idtype, id, callback)
    }
  },
  getAnnotations: function(idtype, id, callback) {
    if (idtype === 'channel' || idtype === 'user') {
      var ref = this
      request.get({
        url: ref.apiroot + '/' + idtype + 's/' + id + '?include_annotations=1'
      }, function(e, r, body) {
        if (!e && r.statusCode === 200) {
          var res = JSON.parse(body)
          //console.log('notes', res.data.annotations);
          callback(res.data.annotations, false, res.meta)
          /*
          var entries=[];
          for(var i in res.data) {
            var post=res.data[i];
            ref.dispatcher.setPost(post);
            var entry={
              idtype: 'post',
              typeid: post.id,
              type: 'hashtag',
              text: hashtag
            };
            entries.push(entry);
          }
          callback(entries, null, res.meta);
          */
        } else {
          console.log('dataccess.proxy-admin.js:getAnnotations - request failure')
          console.log('error', e)
          console.log('statusCode', r.statusCode)
          console.log('body', body)
          callback(null, e, null)
        }
      })
      return
    }
    console.log('dataccess.proxy-admin.js::getAnnotations - write me!')
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback)
    }
  },
  /** follow */
  setFollow: function(srcid, trgid, id, del, ts, callback) {
    if (this.next) {
      this.next.setFollow(srcid, trgid, id, del, ts, callback)
    }
  },
  getFollowing: function(userid, params, callback) {
    if (userid === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getFollowing - userid is undefined')
      return
    }
    if (this.next) {
      this.next.getFollowing(userid, params, callback)
      return
    }
    callback(null, [])
  },
  getFollows: function(userid, params, callback) {
    if (userid === undefined) {
      callback(null, 'dataccess.proxy-admin.js::getFollows - userid is undefined')
      return
    }
    if (this.next) {
      this.next.getFollows(userid, params, callback)
      return
    }
    callback(null, [])
  },
  /** Star/Interactions */
  addStar: function(postid, token, callback) {
    var ref = this
    console.log('proxying posts/star ' + postid)
    proxywrites++
    proxycalls++
    request.post({
      url: ref.apiroot + '/posts/' + postid + '/star',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var data = JSON.parse(body)
        if (data.meta.code === 200) {
          //console.dir(data.data);
          console.log('post star written to network as ' + data.data.id + ' as ' + data.data.user.id)
          // the response can be setPost'd
          //ref.setPost(body);
          // it's formatted as ADN format
          // callback needs to expect DB format...
          // mainly the created_at
          callback(data.data, null)
        } else {
          console.log('failure? ', data.meta)
          callback(null, e)
        }
      } else {
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e)
      }
      /*
      if (this.next) {
        this.next.addStar(postid, token, callback);
      } else {
        console.log('dataaccess.base.js::addStar - write me!');
        callback(null, null);
      }
      */
    })
  },
  delStar: function(postid, token, callback) {
    var ref = this
    console.log('proxying posts/unstar ' + postid)
    proxywrites++
    proxycalls++
    request.del({
      url: ref.apiroot + '/posts/' + postid + '/star',
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + token
      }
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var data = JSON.parse(body)
        if (data.meta.code === 200) {
          //console.dir(data.data);
          console.log('post unstar written to network as ' + data.data.id + ' as ' + data.data.user.id)
          // the response can be setPost'd
          //ref.setPost(body);
          // it's formatted as ADN format
          // callback needs to expect DB format...
          // mainly the created_at
          callback(data.data, null)
        } else {
          console.log('failure? ', data.meta)
          callback(null, e)
        }
      } else {
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e)
      }
      /*
      if (this.next) {
        this.next.addStar(postid, token, callback);
      } else {
        console.log('dataaccess.base.js::delStar - write me!');
        callback(null, null);
      }
      */
    })
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    if (this.next) {
      this.next.setInteraction(userid, postid, type, metaid, deleted, ts, callback)
    }
  },
  // getUserInteractions, remember reposts are stored here too
  // if we're going to use one table, let's keep the code advantages from that
  // getUserStarPosts
  getInteractions: function(type, userid, params, callback) {
    if (type === 'star') {
      var ref = this
      console.log('proxying user/stars ' + userid)
      proxycalls++
      request.get({
        url: ref.apiroot + '/users/' + userid + '/stars'
      }, function(e, r, body) {
        if (!e && r.statusCode === 200) {
          var res = JSON.parse(body)
          // returns a list of posts but not what this function normally returns
          // a list of interactions
          //console.log(res);
          var actions = []
          for (var i in res.data) {
            var post = res.data[i]
            //ref.dispatcher.setPost(post);
            ref.dispatcher.apiToPost(post, res.meta, function(apipost, err) {
              ref.dispatcher.setStar({
                post: apipost,
                user: {
                  id: userid
                }
              }, 0, 0, Date.now())
            })
            var action = {
              userid: userid,
              type: 'star',
              datetime: post.created_at,
              idtype: 'post',
              typeid: post.id,
              asthisid: 0 // meta.id
            }
            actions.push(action)
          }
          callback(actions, null, res.meta)
        } else {
          console.log('dataccess.proxy-admin.js:getUserStars - request failure')
          console.log('error', e)
          console.log('statusCode', r.statusCode)
          console.log('body', body)
          callback(null, e, null)
        }
      })
    } else {
      console.log('dataccess.proxy-admin.js::getInteractions - write me! type: ' + type)
    }
    if (this.next) {
      this.next.getInteractions(type, userid, params, callback)
    }
  },
  getOEmbed: function(url, callback) {
    var ref = this
    console.log('proxying oembed url ' + url)
    proxycalls++
    request.get({
      url: ref.apiroot + '/oembed?url=' + url
    }, function(e, r, body) {
      if (!e && r.statusCode === 200) {
        var data = JSON.parse(body) // no data container, weird...
        //console.log('dataccess.proxy-admin.js::getOEmbed - got ',res);
        callback(data, null)
      } else {
        console.log('dataccess.proxy-admin.js:getOEmbed - request failure')
        console.log('error', e)
        console.log('statusCode', r.statusCode)
        console.log('body', body)
        callback(null, e, null)
      }
    })
  }
}
