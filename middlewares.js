var obj = require('./lib.platform');
var dispatcher = obj.dispatcher;
var streamEngine = obj.streamEngine;
var nconf = obj.nconf;

var Cookies = require('cookies');

/** set up query parameters */
// all Boolean (0 or 1) and prefixed by include_
var generalParams=['muted','deleted','directed_posts','machine','starred_by','reposters','annotations','post_annotations','user_annotations','html','marker','read','recent_messages','message_annotations','inactive','incomplete','private','file_annotations'];
// Stream Faceting allows you to filter and query a user's personalized stream or unified stream with an interface similar to our Post Search API. If you use stream faceting, the API will only return recent posts in a user's stream.
// Boolean (0 or 1)
var streamFacetParams=['has_oembed_photo'];
var pageParams=['since_id','before_id','count','last_read','last_read_inclusive','marker','marker_inclusive'];
var channelParams=['channel_types'];
var fileParams=['file_types'];

let upstream_client_id;

/**
 * Set up middleware to check for prettyPrint
 * This is run on each incoming request
 */
var hits = 0
function adnMiddleware(req, res, next) {
  res.start=new Date().getTime();
  res.path=req.path;
  //console.dir(req); // super express debug
  var token=null;
  if (req.get('Authorization') || req.query.access_token) {
    if (req.query.access_token) {
      //console.log('middleware.js - Authquery',req.query.access_token);
      req.token=req.query.access_token;
      if (typeof(req.token) == 'object') {
        req.token = req.token.filter(function (x, i, a) {
          return a.indexOf(x) == i;
        });
        if (req.token.length == 1) {
          console.warn('reduced multiple similar access_token params')
          req.token = req.token[0] // deArray it
        } else {
          console.log('multiple access_tokens?!? unique list: ', req.token)
        }
      }
      // probably should validate the token here
      /*
      console.log('middleware.js - getUserClientByToken',req.token);
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        if (usertoken==null) {
          console.log('Invalid query token (Server restarted on clients?...): '+req.query.access_token+' err: '+err);
          req.token=null;
          if (req.get('Authorization')) {
            //console.log('Authorization: '+req.get('Authorization'));
            // Authorization Bearer <YOUR ACCESS TOKEN>
            req.token=req.get('Authorization').replace('Bearer ', '');
          }
        } else {
          token=usertoken;
          console.log('token marked valid');
        }
      });
      */
    } else {
      //console.log('authheader');
      if (req.get('Authorization')) {
        //console.log('Authorization: '+req.get('Authorization'));
        // Authorization Bearer <YOUR ACCESS TOKEN>
        req.token=req.get('Authorization').replace('Bearer ', '');
        /*
        dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
          if (usertoken==null) {
            console.log('Invalid header token (Server restarted on clients?...): '+req.token);
            req.token=null;
          } else {
            token=usertoken;
          }
        });
        */
      }
    }
  }

  // debug incoming requests
  if (upstream_client_id === undefined) {
    if (nconf && nconf.get) {
      upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';
    } else {
      console.log('middleware.js - nconf is not configured')
    }
  }
  if (dispatcher.notsilent && upstream_client_id!='NotSet') {
    process.stdout.write("\n");
  }
  // not any of these
  /*
  if (!(req.path.match(/^\/channels/) || req.path.match(/^\/posts\/\d+\/replies/) ||
    req.path.match(/^\/users\/@[A-z]+\/posts/) || req.path.match(/^\/users\/\@/) ||
    req.path == '/posts/stream/global' || req.path == '/users/me/files')) {
    console.log(hits, 'Request for '+req.path);
  }
  */

  // map to bool but handle '0' and '1' just like 'true' and 'false'
  function stringToBool(str) {
    if (str === '0' || str === 'false' || str === 'null' || str === 'undefined') {
      return false;
    }
    // handle ints and bool types too
    return str?true:false;
  }
  // set defaults
  //  Defaults to false except when you specifically request a Post from a muted user or when you specifically request a muted user's stream.
  var generalParams={};
  generalParams.muted=false;
  generalParams.deleted=true; // include_deleted (posts say defaults to true)
  if (req.query.include_deleted!==undefined) {
    //console.log("Overriding include_deleted to", req.query.include_deleted);
    if (req.query.include_deleted instanceof Array) {
      generalParams.deleted=stringToBool(req.query.include_deleted.pop());
    } else {
      generalParams.deleted=stringToBool(req.query.include_deleted);
    }
  }

  // Defaults to false for "My Stream" and true everywhere else.
  generalParams.directed_posts=true;
  generalParams.machine=false;
  generalParams.starred_by=false;
  generalParams.reposters=false;

  generalParams.annotations=false;
  if (req.query.include_annotations!==undefined) {
    //console.log("Overriding include_annotations to", req.query.include_annotations);
    generalParams.annotations=stringToBool(req.query.include_annotations);
  }

  generalParams.post_annotations=false;
  if (req.query.include_post_annotations!==undefined) {
    //console.log("Overriding include_post_annotations to", req.query.include_post_annotations);
    generalParams.post_annotations=stringToBool(req.query.include_post_annotations);
  }
  generalParams.user_annotations=false;
  if (req.query.include_user_annotations!==undefined) {
    //console.log("Overriding include_user_annotations to", req.query.include_user_annotations);
    generalParams.user_annotations=stringToBool(req.query.include_user_annotations);
  }
  generalParams.html=true;
  // channel
  generalParams.marker=false;
  generalParams.read=true;
  generalParams.recent_messages=false;
  generalParams.message_annotations=false;
  generalParams.inactive=false;
  // file
  generalParams.incomplete=true;
  generalParams.private=true;
  generalParams.file_annotations=false;
  //
  var channelParams={};
  channelParams.types='';
  if (req.query.channel_types) {
    //console.log("Overriding channel_types to "+req.query.channel_types);
    channelParams.types=req.query.channel_types;
  }
  channelParams.inactive = false;
  if (req.query.include_inactive) {
    //console.log("Overriding include_inactive to "+req.query.include_inactive);
    channelParams.inactive=stringToBool(req.query.include_inactive);
  }
  var fileParams={};
  fileParams.types='';
  if (req.query.file_types) {
    //console.log("Overriding file_types to "+req.query.file_types);
    fileParams.types=req.query.channel_types;
  }
  var stremFacetParams={};
  stremFacetParams.has_oembed_photo=false;
  var pageParams={};
  pageParams.since_id=false;
  if (req.query.since_id) {
    //console.log("Overriding since_id to "+req.query.since_id);
    pageParams.since_id=parseInt(req.query.since_id);
  }
  pageParams.before_id=false;
  if (req.query.before_id) {
    //console.log("Overriding before_id to "+req.query.before_id);
    pageParams.before_id=parseInt(req.query.before_id);
  }
  pageParams.count=20;
  if (req.query.count) {
    //console.log("Overriding count to "+req.query.count);
    pageParams.count=Math.min(Math.max(req.query.count, -200), 200);
  }
  // stream marker supported endpoints only
  pageParams.last_read=false;
  pageParams.last_read_inclusive=false;
  pageParams.last_marker=false;
  pageParams.last_marker_inclusive=false;
  // put objects into request
  req.apiParams={
    generalParams: generalParams,
    channelParams: channelParams,
    fileParams: fileParams,
    stremFacetParams: stremFacetParams,
    pageParams: pageParams,
    tokenobj: token,
    token: req.token,
  }
  // configure response
  res.prettyPrint=req.get('X-ADN-Pretty-JSON') || 0;
  // non-ADN spec, ryantharp hack
  if (req.query.prettyPrint) {
    res.prettyPrint=1;
  }
  res.JSONP=req.query.callback || '';
  req.cookies = new Cookies(req, res);
  if (req.query.connection_id==="null") {
    console.log('middleware connection_id querystring is null');
  }
  if (req.query.connection_id && req.query.connection_id!=="null") {
    if (streamEngine) {
      console.log('middleware.js hijacking request because connection_id', req.query.connection_id, req.token, 'on', req.path);
      streamEngine.handleSubscription(req, res);
      return;
    } else {
      console.log('streamEngine is not enabled');
      var resObj={
        "meta": {
          "code": 404,
          "error_message": "Not enabled"
        }
      };
      res.status(404).type('application/json').send(JSON.stringify(resObj));
      return;
    }
  }
  next();
}

function corsMiddleware(req, res, next){
  res.start=new Date().getTime();
  origin = req.get('Origin') || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Expose-Headers', 'Content-Length');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization'); // add the list of headers your site allows.
  if (req.method === 'OPTIONS') {
    var ts=new Date().getTime();
    var diff = ts - res.start;
    if (diff > 100) {
      console.log('app.js - OPTIONS requests served in', diff+'ms', req.path);
    }
    return res.sendStatus(200);
  }
  next();
}

function debugMiddleware(req, res, next) {
  console.debug('DBGrequest', req.method, req.path)
  if (req.method == 'POST') {
    //console.debug('DBGbody', req)
    var body = '';

    req.on('data', function (data) {
      body += data;

      // Too much POST data, kill the connection!
      // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
      if (body.length > 1e6)
        req.connection.destroy();
    });

    req.on('end', function () {
      console.log('post body', body)
      // use post['blah'], etc.
    });
  }
  next();
}

module.exports = {
  adnMiddleware: adnMiddleware,
  corsMiddleware: corsMiddleware,
  debugMiddleware: debugMiddleware,
};
