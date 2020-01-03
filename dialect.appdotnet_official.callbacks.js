const userRoutes = require('./modules/users/users.routes')

function sendresponse(json, resp) {
  var ts = new Date().getTime()
  var diff = ts-resp.start
  if (diff > 1000) {
    // this could be to do the client's connection speed
    // how because we stop the clock before we send the response...
    console.log(resp.path+' served in '+(ts-resp.start)+'ms')
  }
  if (resp.prettyPrint) {
    json = JSON.stringify(JSON.parse(json),null,4)
  }
  //resp.set('Content-Type', 'text/javascript')
  resp.type('application/json')
  resp.setHeader("Access-Control-Allow-Origin", "*")
  resp.send(json)
}

function sendObject(obj, resp) {
  var ts = new Date().getTime()
  var diff = ts-resp.start
  if (diff > 1000) {
    // this could be to do the client's connection speed
    // how because we stop the clock before we send the response...
    console.log(resp.path+' served in '+(ts-resp.start)+'ms')
  }

  if (obj.meta === undefined) {
    obj.meta = { code: 200 }
  }

  if (obj.meta && obj.meta.code) {
    resp.status(obj.meta.code)
  }

  resp.type('application/json')
  resp.setHeader("Access-Control-Allow-Origin", "*")

  resp.send(JSON.stringify(obj, null, resp.prettyPrint ? 4 : null))
}

function ISODateString(d) {
  if (!d || !d.getUTCFullYear) {
    //console.log('created_at is type (!date): ',d,typeof(d))
    return d
  }
  function pad(n){return n<10 ? '0'+n : n}
  return d.getUTCFullYear()+'-'
    + pad(d.getUTCMonth()+1)+'-'
    + pad(d.getUTCDate())+'T'
    + pad(d.getUTCHours())+':'
    + pad(d.getUTCMinutes())+':'
    + pad(parseInt(d.getUTCSeconds()))+'Z'
}

function formattoken(token) {
  // TODO: write me
  if (token.user) {
    token.user = userRoutes.formatuser(token.user, token)
  }
  /*
    app: {
      client_id: "m89LnrxQBWt3SgwHaGdDreym2fJuJnvA",
      link: "http://foo.example.com",
      name: "Test app",
    },
    scopes: [
      "stream",
      "messages",
      "export",
      "write_post",
      "follow"
    ],
    limits: {
      "following": 40,
      "max_file_size": 10000000
    },
    "storage": {
      "available": 8787479688,
      "used": 1212520312
    },
    user: userRoutes.formatuser(user, token),
    "invite_link": "https://join.app.net/from/notareallink"
  */
  return token
}



function formatpost(post, token) {
  // cast fields to make sure they're the correct type

  // Now to cast
  if (post) {
    post.id = '' + post.id // cast to String
    post.num_replies = parseInt(0 + post.num_replies) // cast to Number
    post.num_reposts = parseInt(0 + post.num_reposts) // cast to Number
    post.num_stars = parseInt(0 + post.num_stars) // cast to Number
    post.machine_only = post.machine_only ? true : false
    post.is_deleted = post.is_deleted ? true : false
    post.thread_id = ''+post.thread_id // cast to String (Number is too big for js?)
    if (post.reply_to) {
      post.reply_to = ''+post.reply_to // cast to String (Number is too big for js?)
    }
    // remove microtime
    post.created_at = ISODateString(post.created_at)
    if (token) {
      // boolean (and what about the non-existent state?)
      post.you_reposted = post.you_reposted ? true : false
      post.you_starred = post.you_starred ? true : false
    }
  }
  return post
}

module.exports = {
  ISODateString: ISODateString,
  sendObject: sendObject,
  'postsCallback' : function(resp, token) {
    return function(err, posts, meta) {
      //console.log('dialect.appdotnet_official.callback.js::postsCallback - in posts callback', posts.length, 'posts', posts)
      for(var i in posts) {
        var post = posts[i]
        //console.log('dialect.appdotnet_official.callback.js::postsCallback - looking at ', post, post.id, post.created_at, post.userid)
        posts[i] = formatpost(post, token)
        if (post.repost_of) {
          // this is an object...
          post.repost_of.user = userRoutes.formatuser(post.repost_of.user, token)
          post.repost_of = formatpost(post.repost_of, token)
        }
        if (typeof(post.user)=='undefined') {
          console.log('dialect.appdotnet_official.callback.js::postsCallback - missing user for post '+i)
          posts[i].user = {}
        } else {
          posts[i].user = userRoutes.formatuser(post.user, token)
        }
      }
      //console.log('dialect.appdotnet_official.callback.js::postsCallback - sending', posts.length, 'posts')
      // meta order: min_id, code, max_id, more
      var res = {
        meta: meta,
        data: posts
      }
      sendObject(res, resp)
    }
  },

  'posts2usersCallback' : function(resp, token) {
    // posts is a hack, we're converting things like global to user lists
    // we need to not do this...
    return function(err, posts, meta) {
      var users = []
      // if any return fucking nothing (null) kill them (don't push them)
      for(var i in posts) {
        users.push(userRoutes.formatuser(posts[i].user, token))
      }
      //console.log('returning', users)
      // meta order: min_id, code, max_id, more
      var res = {
        meta: meta,
        data: users
      }
      sendObject(res, resp)
    }
  },
  'postCallback' : function(resp, token) {
    return function(err, post, meta) {
      // console.log('postCallack post', post, 'err', err, 'meta', meta)
      var res = {
        meta: { code: 200 },
        data: formatpost(post, token)
      }
      if (post && post.user) {
        res.data.user = userRoutes.formatuser(post.user, token)
      }
      if (meta) {
        res.meta = meta
      }
      sendObject(res, resp)
    }
  },

  'tokenCallback' : function(resp, token) {
    return function(err, data, meta) {
      err = typeof err !== 'undefined' ? err : undefined
      meta = typeof meta !== 'undefined' ? meta : undefined
      var res={
        meta: meta,
        data: formattoken(data)
      }
      sendObject(res, resp)
    }
  },

  // what's the difference between this and post?
  'dataCallback' : function(resp) {
    return function(err, data, meta) {
      err = typeof err !== 'undefined' ? err : undefined
      meta = typeof meta !== 'undefined' ? meta : undefined
      var res={
        meta: meta,
        data: data
      }
      sendObject(res, resp)
    }
  },

  'fileCallback': function(resp, token) {
    return function(err, data, meta) {
      console.log('fileCallback', data, 'err', err, 'meta', meta)
      err = typeof err !== 'undefined' ? err : undefined
      meta = typeof meta !== 'undefined' ? meta : undefined
      var res={
        meta: meta,
        data: data
      }
      sendObject(res, resp)
    }
  },

  'oembedCallback' : function(resp) {
    return function(err, oembed) {
      // there's no data/meta envelope for oembed
      //console.log('ADNO::oembed got ',oembed)
      sendresponse(JSON.stringify(oembed), resp)
    }
  },
}
