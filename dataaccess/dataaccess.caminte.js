/**
 * real long term persistence
 * @module dataaccess_camintejs
 */

const configUtil = require('../lib/lib.config.js')

const funcs = []
// token is p. foundational
funcs.push(require('../modules/users/sessions.model'))
funcs.push(require('../modules/users/users.model'))
funcs.push(require('../modules/users/mutes.model'))
funcs.push(require('../modules/users/annotations.model'))
funcs.push(require('../modules/users/entities.model'))

// needs by posts/messages
// could be foundation (put in users)
funcs.push(require('../modules/clients/clients.model'))

if (configUtil.moduleEnabled('channels')) {
  funcs.push(require('../modules/channels/channels.model'))
  funcs.push(require('../modules/channels/messages.model'))
  funcs.push(require('../modules/channels/subscriptions.model'))
}

if (configUtil.moduleEnabled('posts')) {
  funcs.push(require('../modules/posts/posts.model'))
  funcs.push(require('../modules/posts/interactions.model'))
}
if (configUtil.moduleEnabled('follows')) {
  funcs.push(require('../modules/follows/follows.model'))
}
if (configUtil.moduleEnabled('files')) {
  funcs.push(require('../modules/files/files.model'))
}
if (configUtil.moduleEnabled('streams')) {
  funcs.push(require('../modules/streams/userstreams.model'))
  funcs.push(require('../modules/streams/appstreams.model'))
}
if (configUtil.moduleEnabled('markers')) {
  funcs.push(require('../modules/markers/streammarkers.model'))
}

/**
 * http://www.camintejs.com / https://github.com/biggora/caminte
 * @type {Object}
 */

// caminte can support:  mysql, sqlite3, riak, postgres, couchdb, mongodb, redis, neo4j, firebird, rethinkdb, tingodb
// however AltAPI will officially support: sqlite, Redis or MySQL for long term storage
//
// @duerig wants Redis for long term storage
// however it requires the entire dataset to be in memory,
// so not all the network data could be store in it, unless you have 128gb+ of memory
// 1gb of memory in redis right now (with Jun 2014 data models) holds roughly:
// ~200k posts (204k annotations, 246k entities) ~10k users (6k follows) 2.4k interactions
//

// so MySQL is good alternative if you want a large dataset
// SQLite is a good incase the user doesn't want to install any extra software

// in memory mode, 400mb holds about 6690U 2694F 84890P 0C 0M 0s 770i 83977a 126741e
// memory mode is only good for dev, after buckets get big the API stops responding
// in sqlite3 mode, 50mb of diskspace holds 3736U 1582F 15437P 0C 0M 0s 175i 14239a 29922e

var Schema = require('caminte').Schema

var upstreamUserTokenModel, localUserTokenModel, oauthAppModel,
annotationValuesModel, noticeModel, emptyModel

memoryUpdate = function (model, filter, data, callback) {
  'use strict'
  if ('function' === typeof filter) {
    return filter(new Error('Get parametrs undefined'), null)
  }
  if ('function' === typeof data) {
    return data(new Error('Set parametrs undefined'), null)
  }
  filter = filter.where ? filter.where : filter
  var mem = this
  //console.log('memoryUpdate - model', model, 'filter', filter, 'data', data, 'callback', callback)

  // filter input to make sure it only contains valid fields
  var cleanData = this.toDatabase(model, data)

  if (filter.id) {
    // should find one and only one
    this.exists(model, filter.id, function (err, exists) {
      if (err) console.error('memoryUpdate exists err', err)
      if (exists) {
        mem.save(model, Object.assign(mem.cache[model][filter.id], cleanData), callback)
      } else {
        callback(err, cleanData)
      }
    })
  } else {
    //console.log('memoryUpdate - not implemented, search by?', filter, data)
    this.all(model, filter, function(err, nodes) {
      //console.log('memoryUpdate - records', nodes)
      if (err) console.error('memoryUpdate all err', err)
      var count = nodes.length
      if (!count) {
        return callback(false, cleanData)
      }
      nodes.forEach(function(node) {
        mem.cache[model][node.id] = Object.assign(node, cleanData)
        if (--count === 0) {
          callback(false, cleanData)
        }
      })
    })
  }
}


// set up the configureable model pools
function start(nconf) {
  // 6379 is default redis port number

  // reconfigure path

  /** schema data backend type */
  var defaultSchemaType = nconf.get('database:default:type') || 'memory'
  var defaultOptions = nconf.get('database:default:options')
  //console.log('default type', defaultSchemaType)

  /** set up where we're storing the "network data" */
  var configData = nconf.get('database:tokenModel:options') || defaultOptions
  var schemaDataType = nconf.get('database:tokenModel:type') || defaultSchemaType
  //console.log('configuring data', configData)
  var schemaData = new Schema(schemaDataType, configData)
  if (schemaDataType === 'memory') {
    schemaData.adapter.update = memoryUpdate
  }

  /** set up where we're storing the tokens */
  var configToken = nconf.get('database:dataModel:options') || defaultOptions
  var schemaTokenType = nconf.get('database:tokenModel:type') || defaultSchemaType
  //console.log('configuring token', configData)
  var schemaToken = new Schema(schemaTokenType, configToken)
  if (schemaTokenType === 'memory') {
    schemaToken.adapter.update = memoryUpdate
  }

  if (schemaDataType==='mysql') {
    console.log('MySQL detected')
    //charset: "utf8_general_ci" / utf8mb4_general_ci
    // run a query "set names utf8"
    schemaData.client.changeUser({ charset: 'utf8mb4' }, function(err) {
      if (err) console.error('Couldnt set UTF8mb4', err)
      //console.log('Set charset to utf8mb4 on Data')
    })
    schemaToken.client.changeUser({ charset: 'utf8mb4' }, function(err) {
      if (err) console.error('Couldnt set UTF8mb4', err)
      //console.log('Set charset to utf8mb4 on Token')
    })
    schemaData.autoupdate(function() {
      // FIXME: avoid doing these each start up
      schemaToken.client.query('alter table post MODIFY `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', function (error, results, fields) {
        if (error) console.error('emoji upgrade error', error)
        console.log('post emoji enabled')
      })
      schemaToken.client.query('alter table post MODIFY `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', function (error, results, fields) {
        if (error) console.error('emoji upgrade error', error)
        console.log('post emoji enabled')
      })
      schemaToken.client.query('alter table message MODIFY `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', function (error, results, fields) {
        if (error) console.error('emoji upgrade error', error)
        console.log('message emoji enabled')
      })
      schemaToken.client.query('alter table message MODIFY `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', function (error, results, fields) {
        if (error) console.error('emoji upgrade error', error)
        console.log('message emoji enabled')
      })
      schemaToken.client.query('alter table annotation MODIFY `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', function (error, results, fields) {
        if (error) console.error('emoji upgrade error', error)
        console.log('annotation emoji enabled')
      })
      schemaToken.client.query('alter table user MODIFY `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', function (error, results, fields) {
        if (error) console.error('emoji upgrade error', error)
        console.log('user name emoji enabled')
      })
    })

    // to enable emojis we need to run these
    // alter table post MODIFY `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table post MODIFY `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table message MODIFY `text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table message MODIFY `html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table annotation MODIFY `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    // alter table user MODIFY `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
  }

  // Auth models and accessors can be moved into own file?
  // so that routes.* can access them separately from everything!

  // NOTE: all models automically have a default 'id' field that's an AutoIncrement

  var modelOptions = {
    schemaData: schemaData,
    // we could also just put it in the exports...
    applyParams: applyParams,
  }
  funcs.forEach((func) => {
    func.start(modelOptions)
  })

  /**
   * Token Models
   */

  /** upstreamUserToken storage model */
  upstreamUserTokenModel = schemaToken.define('upstreamUserToken', {
    userid: { type: Number, index: true },
    /** comma separate list of scopes. Available scopes:
      'basic','stream','write_post','follow','update_profile','public_messages','messages','files' */
    scopes: { type: String, length: 255 },
    token: { type: String, length: 98, index: true },
  })
  // scopes 'public_messages','messages','files':*
  // but we can be multiple, not just one...
  //localUserTokenModel.validatesInclusionOf('scopes', { in: ['basic','stream','write_post','follow','update_profile','public_messages','messages','files']})
  upstreamUserTokenModel.validatesUniquenessOf('token', { message:'token is not unique'})

  // localTokens
  // we could add created_at,updated_at,last_used
  // move out scopes to grant and link to grants
  localUserTokenModel = schemaToken.define('localUserToken', {
    userid: { type: Number, index: true },
    token: { type: String, length: 98, index: true },
    client_id: { type: String, length: 32, index: true },
    /** comma separate list of scopes. Available scopes:
      'basic','stream','write_post','follow','update_profile','public_messages','messages','files' */
    scopes: { type: String, length: 255 },
    created_at: { type: Date },
    expires_at: { type: Date },
  })
  //  code: { type: String, length: 255 },
  //  grantid: { type: Number, index: true },
  // scopes 'public_messages','messages','files':*
  // but we can be multiple, not just one...
  //localUserTokenModel.validatesInclusionOf('scopes', { in: ['basic','stream','write_post','follow','update_profile','public_messages','messages','files']})
  // token, client_id are unique
  //localUserTokenModel.validatesUniquenessOf('token', { message:'token is not unique'})

  // local apps
  // dupcliation of clientModel
  oauthAppModel = schemaToken.define('oauthApp', {
    //accountid: { type: Number, index: true },
    client_id: { type: String, length: 32, index: true },
    secret: { type: String, length: 255 },
    shortname: { type: String, length: 255 },
    displayname: { type: String, length: 255 },
    token: { type: String, length: 255 } // app token
  })
  // authorized local app callbacks
  oauthCallbackModel = schemaToken.define('oauthCallback', {
    appid: { type: Number, index: true }, // deprecated
    clientid: { type: Number, index: true },
    url: { type: String, length: 255 }
  })
  // I think it's better we have a combined table (localUserToken)
  // we could put "code" into the localUserTokenModel
  // because we're not going to have more than one token per user
  /*
  // local app grants (could replace session?)
  var oauthGrantModel = schemaToken.define('oauthGrant', {
    appid: { type: Number, index: true },
    scope: { type: String, length: 255 },
    userid: { type: Number, index: true },
    code: { type: String, length: 255 },
  })
  */
  // well localUserToken is a combo of grants and tokens

  // Auth models and accessors can be moved into own file?
  // so that routes.* can access them separately from everything!

  // NOTE: all models automically have a default 'id' field that's an AutoIncrement

  // DEPRECATE UserTokenModel, it became localUserToken

  /** appToken storage model */
  // let's only have one app_token per client (app)
  /*
  var appTokenModel = schemaToken.define('appToken', {
    client_id: { type: String, length: 32 },
    token: { type: String, lenghh: 98 },
  })
  appTokenModel.validatesUniquenessOf('token', {message:'token is not unique'})
  */

  /**
   * Network Data Models
   */

  // maybe not needed with JSON type
  /** annotation values storage model */
  annotationValuesModel = schemaData.define('annotationvalues', {
    annotationid: { type: Number, index: true },
    key: { type: String, length: 255, index: true },
    value: { type: schemaData.Text }, // kind of want to index this
    memberof: { type: Number, index: true }
  })

  // intermediate cache table for querying (a view of interactionModel)
  // we have to denormalize this for performance
  // takes more memory/storage but required if you want responsive interactions
  noticeModel = schemaData.define('notice', {
    event_date: { type: Date, index: true },
    notifyuserid: { type: Number, index: true }, // who should be notified
    actionuserid: { type: Number }, // who took an action (star)
    type: { type: String, length: 18 }, // welcome,star,repost,reply,follow,broadcast_create,broadcast_subscribe,broadcast_unsubscribe
    typeid: { type: Number }, // postid(star,respot,reply),userid(follow)
    altnum: { type: Number }, // postid(star,respot,reply),userid(follow)
  })

  // kind of a proxy cache
  // we'll it's valid to check the upstream
  // maybe a time out
  // actually downloader is in charge of refreshing, as long as we kick that off
  // we can still use this
  // we know there's no data for this
  emptyModel = schemaData.define('empty', {
    type: { type: String, length: 16, index: true }, // repost, replies
    typeid: { type: Number, index: true }, // postid
    last_updated: { type: Date },
  })

  //if firstrun (for sqlite3, mysql)
  if (schemaDataType=='mysql' || schemaDataType=='sqlite3') {
    //schemaData.automigrate(function() {})
    //schemaToken.automigrate(function() {})
    // don't lose data
    schemaData.autoupdate(function() {})
    schemaToken.autoupdate(function() {})
  }

  // Auth Todo: localUser, localClient
  // Token Todo: userToken, appToken
  // Rate Todo: userTokenLimit, appTokenLimit
  // Data Todo: mutes, blocks, upstream_tokens

  /*
  setInterval(function() {
    if (module.exports.connection) {
      module.exports.connection.ping(function (err) {
        if (err) {
          console.log('lets_parser::monitor - reconnecting, no ping')
          ref.conn(module.exports.last.host, module.exports.last.user,
            module.exports.last.pass, module.exports.last.db)
        }
        //console.log(Date.now(), 'MySQL responded to ping')
      })
    }
  }, 60000)
  */

  /** minutely status report */
  // @todo name function and call it on startup
  var statusmonitor=function () {
    if (schemaDataType=='mysql') {
      schemaData.client.ping(function (err) {
        if (err) {
          console.log('trying to reconnect to data db')
          schemaData = new Schema(schemaDataType, configData)
        }
      })
    }
    if (schemaDataType=='mysql') {
      schemaToken.client.ping(function (err) {
        if (err) {
          console.log('trying to reconnect to token db')
          schemaToken = new Schema(schemaDataType, configToken)
        }
      })
    }

    var ts=new Date().getTime()
    // this is going to be really slow on innodb
    /*
    userModel.count({}, function(err, userCount) {
      followModel.count({}, function(err, followCount) {
        postModel.count({}, function(err, postCount) {
          channelModel.count({}, function(err, channelCount) {
            messageModel.count({}, function(err, messageCount) {
              subscriptionModel.count({}, function(err, subscriptionCount) {
                interactionModel.count({}, function(err, interactionCount) {
                  annotationModel.count({}, function(err, annotationCount) {
                    entityModel.count({}, function(err, entityCount) {
                      noticeModel.count({}, function(err, noticeCount) {
                        // break so the line stands out from the instant updates
                        // dispatcher's output handles this for now
                        //process.stdout.write("\n")
                        // if using redis
                        if (schemaDataType=='sqlite3') {
                          schemaData.client.get('PRAGMA page_count;', function(err, crow) {
                            //console.log('dataaccess.caminte.js::status sqlite3 page_count', row)
                            schemaData.client.get('PRAGMA page_size;', function(err, srow) {
                              var cnt=crow['page_count']
                              var psize=srow['page_size']
                              var size=cnt*psize
                              console.log('dataaccess.caminte.js::status sqlite3 data [',cnt,'x',psize,'] size: ', size)
                            })
                          })
                        }
                        if (schemaDataType=='redis') {
                          //console.dir(schemaAuth.client.server_info)
                          // just need a redis info call to pull memory and keys stats
                          // evicted_keys, expired_keys are interesting, keyspace_hits/misses
                          // total_commands_proccesed, total_connections_received, connected_clients
                          // update internal counters
                          schemaData.client.info(function(err, res) {
                            schemaData.client.on_info_cmd(err, res)
                          })
                          // then pull from counters
                          console.log("dataaccess.caminte.js::status redis token "+schemaToken.client.server_info.used_memory_human+" "+schemaToken.client.server_info.db0)
                          console.log("dataaccess.caminte.js::status redis data "+schemaData.client.server_info.used_memory_human+" "+schemaData.client.server_info.db0)
                        }
                        console.log('dataaccess.caminte.js::status '+userCount+'U '+followCount+'F '+postCount+'P '+channelCount+'C '+messageCount+'M '+subscriptionCount+'s '+interactionCount+'/'+noticeCount+'i '+annotationCount+'a '+entityCount+'e')
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
    */
  }
  statusmonitor()
  setInterval(statusmonitor, 60 * 1000)
}

// Not Cryptographically safe
function generateToken(string_length) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz"
  var randomstring = ''
  for (var x=0; x<string_length; x++) {
    var letterOrNumber = Math.floor(Math.random() * 2)
    if (letterOrNumber == 0) {
      var newNum = Math.floor(Math.random() * 9)
      randomstring += newNum
    } else {
      var rnum = Math.floor(Math.random() * chars.length)
      randomstring += chars.substring(rnum, rnum + 1)
    }
  }
  return randomstring
}


// cheat macros
function db_insert(rec, model, callback) {
  //console.log('dataaccess.caminte.js::db_insert - start')
  if (!rec) {
    if (callback) {
      callback('no record', false, false)
    }
    return
  }
  if (!rec.isValid) {
    var old = rec
    rec = new model(old)
    /*
    for(var i in old) {
      rec[i] = old[i]
    }
    */
  }
  rec.isValid(function(valid) {
    //console.log('dataaccess.caminte.js::db_insert - Checked')
    if (valid) {
      //console.log(typeof(model)+'trying to create ',rec)
      // mysql can't handle any undefineds tbh
      //console.log('dataaccess.caminte.js::db_insert - Valid', rec, typeof(model))
      // sometimes model.create doesn't return...
      // maybe a timer to detect this (timeout) and callback
      model.create(rec, function(err) {
        //console.log('dataaccess.caminte.js::db_insert - created')
        if (err) {
          console.log(typeof(model)+" insert Error ", err)
        }
        if (callback) {
          //console.log('dataaccess.caminte.js::db_insert - callingback')
          if (rec.id) {
            // why don't we just return the entire record
            // that way we can get access to fields we don't have a getter for
            // or are generated on insert
            callback(err, rec)
          } else {
            callback(err)
          }
        }
      })
    } else {
      console.log(typeof(model)+" validation failure")
      console.dir(rec.errors)
      if (callback) {
        // can we tell the different between string and array?
        callback(rec.errors, false, false)
      }
    }
  })
}

function applyParams(query, params, callback) {
  // what if we want all, how do we ask for that if not zero?
  //if (!params.count) params.count=20
  // can't set API defaults here because the dispatch may operate outside the API limits
  // i.e. the dispatch may want all records (Need example, well was getUserPosts of getInteractions)
  //console.log('into applyParams from',params.since_id,'to',params.before_id,'for',params.count)

  // general guard
  /*
  if (maxid<20) {
    // by default downloads the last 20 posts from the id passed in
    // so use 20 so we don't go negative
    // FIXME: change to scoping in params adjustment
    maxid=20
  }
  */
  // create a range it will exist in
  // redis should be able to decisions about how to best optimize this
  // rules out less optimal gambles
  // and since it can't use less optimal gambles on failure
  // uses the 68s system, ugh
  /*
  if (!params.since_id) {
    params.since_id=0
  }
  */
  // well if we have a where on a field, and we ad in id
  // then we can't optimize, let's try without this
  /*
  if (!params.before_id) {
    params.before_id=maxid
  }
  */

  // bullet 5: Remember, items are always returned from newest to oldest even If count is negative
  // if we do our math right, we won't need .limit(params.count)
  // redis maybe need the limit to be performant
  //console.log('test',query.model.modelName)
  // not all objects have id linked to their chronology
  var idfield='id'
  if (query.model.modelName==='entity') {
    // typeid is usually the post
    //query=query.order('typeid', 'DESC').limit(params.count)
    idfield='typeid'
  }
  //if (query.debug) {
    //console.log('dataaccess.caminte::applyParams - model', query.model.modelName)
  //}
  if (query.model.modelName==='post' || query.model.modelName==='message') {
    //if (query.debug) {
      //console.log('dataaccess.caminte::applyParams - params', params.generalParams)
    //}
    // Remember this defaults to show deleted
    if (!params.generalParams || !params.generalParams.deleted) {
      //console.log('hiding deleted')
      query.where('is_deleted', 0) // add delete param
    }
  }
  // if not already sorted, please sort it
  // but some calls request a specific sort
  // though there are cases where we need to flip order
  //console.log('applyParams query order', query.q.params)
  //console.log('applyParams params', params)
  var count = 20
  if (params.pageParams) {
    if (params.pageParams.count!==undefined) {
      count = params.pageParams.count
    }
  } else {
    console.log('dataaccess.caminte::applyParams - WARNING no pageParams in params')
  }

  // items are always returned from newest to oldest even if count is negative
  if (!query.q.params.order) {
    //console.log('applyParams count', count)
    //console.log('applyParams params.count', params.count)
    //if (count>0) {
      //console.log('applyParams sorting', idfield, 'desc')
      query=query.order(idfield, 'DESC')
    //}
    //if (count<0) {
      //console.log('applyParams sorting', idfield, 'asc')
      //query=query.order(idfield, 'ASC')
    //}
  }

  // add one at the end to check if there's more
  var queryCount=Math.abs(count) + 1
  //console.log('count', count, 'queryCount', queryCount)
  query=query.limit(queryCount)

  // this count system only works if we're asking for global
  // and there's not garuntee we have all the global data locally
  /*
  if (params.before_id) {
    if (!params.since_id) {
      // only asking for before this ID, this only works for global
      //params.since_id=Math.max(params.before_id-params.count, 0)
    }
  } else if (params.since_id) {
    // no before but we have since
    // it's maxid+1 because before_id is exclusive
    // params.count was just count
    //params.before_id=Math.min(params.since_id+params.count, maxid+1)
  } else {
    // none set
    // if we have upstream enabled
    params.before_id=maxid
    // count only works if contigeous (global)
    //params.since_id=maxid-params.count
    // if we don't have upstream disable
    // best to proxy global...
  }
  */
  //console.log(query.model.modelName, 'from', params.since_id, 'to', params.before_id, 'should be a count of', params.count, 'test', params.before_id-params.since_id)
  // really won't limit or offset

  // count shouldn't exceed the difference between since and before
  // using Redis, querying by id range isn't fast enough (60 secs)
  //
  // I think between is broken in redis:caminte (helper::parseCond doesn't test for indexes right)
  // yea now we're only getting a CondIndex of 22
  // sunionstore - condIndex 22
  // with between we'd get
  // sunionstore - condIndex 518656
  // both are still around 68s though
  /*
  if (params.since_id && params.before_id) {
    query=query.between('id', [params.since_id, params.before_id])
  } else {
  */
  // 0 or 1 of these will be true
  // uhm both can be true like a between
  // it's not inclusive
  if (params.pageParams) {
    if (params.pageParams.since_id) {
      query=query.gt(idfield, params.pageParams.since_id)
    }
    if (params.pageParams.before_id) {
      // if not before end
      if (params.pageParams.before_id!=-1) {
        query=query.lt(idfield, params.pageParams.before_id)
      }
    }
  }
  //}
  /*
  if (params.since_id && params.before_id) {
  } else if (params.since_id) {
    query=query.gt(params.since_id)
  } else if (params.before_id) {
    query=query.lt(params.before_id)
  }
  */
  if (query.debug) {
    console.log('dataaccess.caminte.js::applyParams query', query.q)
  }
  var min_id=Number.MAX_SAFE_INTEGER, max_id=0
  query.run({},function(err, objects) {
    if (err) {
      console.error('dataaccess.caminte.js::applyParams - err', err)
    }
    //console.log('dataaccess.caminte.js::applyParams -', query.model.modelName, 'query got', objects.length, 'only need', params.count)
    // first figure out "more"
    // if got less than what we requested, we may not have it cached
    // we'll have to rely on meta to know if it's proxied or not
    //console.log('dataaccess.caminte.js::applyParams - got', objects.length, 'queried', queryCount, 'asked_for', count)
    var more = objects.length==queryCount
    // restore object result set
    // which end to pop, well depends on count
    if (more) {
      // if we get 21 and we ask for 20
      //if (count>0) { // id desc
        objects.pop()
      /*
      }
      if (count<0) { // id asc
        for(var i in objects) {
          console.log('dataaccess.caminte.js::applyParams - negative count', objects[i].id)
        }
        objects.pop()
      }
      */
    }
    //console.log('dataaccess.caminte.js::applyParams - resultset got', objects.length, 'range:', min_id, 'to', max_id, 'more:', more)
    // generate meta, find min/max in set
    for(var i in objects) {
      var obj=objects[i]
      //console.log('dataaccess.caminte.js::applyParams - idx', obj[idfield], 'min', min_id, 'max', max_id)
      if (obj[idfield]) {
        min_id=Math.min(min_id, obj[idfield])
        max_id=Math.max(max_id, obj[idfield])
      }
    }
    if (min_id==Number.MAX_SAFE_INTEGER) min_id=0
    var imeta={
      code: 200,
      min_id: min_id,
      max_id: max_id,
      more: more
    }
    // was .reverse on posts, but I don't think that's right for id DESC
    //console.log('dataaccess.caminte.js::applyParams -', query.model.modelName, 'query got', objects.length, 'only need', params.count)
    callback(err, objects, imeta)
  })
}

// we need to know if we have upstreaming enabled
/**
 * @constructs dataaccess
 * @variation camtinejs
 */
let functions = {
  /*
   * oauth local apps / callbacks
   */
  getAppCallbacks: function(client_id, client_secret, callback) {
    if (client_id===undefined) {
      console.log('dataaccess.caminte::getAppCallbacks - no client_id passed in')
      callback('no client_id')
      return
    }
    if (!client_secret) {
      // clientModel.findOne({ where: { client_id: client_id } }, function(err, oauthApp) {
      oauthAppModel.findOne({ where: { client_id: client_id } }, function(err, oauthApp) {
        if (err || !oauthApp) {
          console.log('getAppCallbacks - err', err)
          callback('err or app not found')
          return
        }
        oauthCallbackModel.find({ where: { appid: oauthApp.id } }, function(err, callbacks) {
          callback(callbacks, err)
        })
      })
      return
    }
    // clientModel.findOne({ where: { client_id: client_id, secret: client_secret } }, function(err, oauthApp) {
    // TypeError: callback is not a function?
    // calls look fine
    oauthAppModel.findOne({ where: { client_id: client_id, secret: client_secret } }, function(err, oauthApp) {
      if (err || !oauthApp) {
        if (err) console.log('getAppCallbacks - err', err)
        callback('err or app not found')
        return
      }
      oauthCallbackModel.find({ where: { appid: oauthApp.id } }, callback)
    })
  },
  /*
   * local user token
   */
  // should we really pass token in? it's cleaner separation if we do
  // even though this is the only implemention of the abstraction
  // probably need a set
  // probably should check scopes
  addAPIUserToken: function(userid, client_id, scopes, token, callback) {
    if (scopes===undefined) scopes=''
    // this function is really a set atm
    // FIXME: does this user already have a token?
    // every client will now have a unique token
    // so we're just checking to see if we need to update the token or create it
    //, client_id: client_id
    localUserTokenModel.findOne({ where: { token: token }}, function(err, tokenUnique) {
      if (err) {
        console.log('caminte.js::addAPIUserToken - token lookup', err)
        callback(null, 'token_lookup')
        return
      }
      if (tokenUnique==null) {
        // try and make sure we don't already have a token for this userid/clientid
        localUserTokenModel.findOne({ where: { userid: userid, client_id: client_id }}, function(err, usertoken) {
          if (usertoken==null) {
            var usertoken=new localUserTokenModel
            usertoken.userid=userid
            usertoken.client_id=client_id
            usertoken.scopes=scopes
            usertoken.token=token
            usertoken.created_at=new Date()
            // this doesn't output anything useful at all
            //console.log('creating localUserToken', usertoken)
            /*usertoken.save(function() {
              callback(usertoken, null)
            })*/
            // this will call callback if set
            db_insert(usertoken, localUserTokenModel, callback)
          } else {
            console.log('Already have token')
            //usertoken.userid=userid
            //usertoken.client_id=client_id
            // update scopes and token
            usertoken.scopes=scopes
            usertoken.token=token
            usertoken.save()
            // check scopes
            // do we auto upgrade scopes?
            // probably should just fail
            if (callback) {
              callback(usertoken, 'Already have token')
            }
          }
        })
      } else {
        //console.log('already had token on file', tokenUnique)
        //console.log('compare against', userid, client_id)
        // probably should check scopes
        if (userid==tokenUnique.userid && client_id==tokenUnique.client_id) {
          callback(tokenUnique, null)
        } else {
          console.log('already had token on file', tokenUnique)
          console.log('compare against', userid, client_id)
          console.log('tests', userid==tokenUnique.userid, client_id==tokenUnique.client_id)
          callback(null, 'token_inuse')
        }
      }
    })
  },
  // allow a user to have more than one token
  addUnconstrainedAPIUserToken: function(userid, client_id, scopes, token, expireInMins, callback) {
    // make sure this token is not in use
    localUserTokenModel.findOne({ where: { token: token }}, function(err, tokenUnique) {
      if (err) {
        console.log('caminte.js::addAPIUserToken - token lookup', err)
        callback(null, 'token_lookup')
        return
      }
      //console.log('userid', userid)
      // token is not in use, please create it
      var usertoken=new localUserTokenModel
      usertoken.userid=userid
      usertoken.client_id=client_id
      usertoken.scopes=scopes
      usertoken.token=token
      usertoken.created_at=new Date()
      if (expireInMins) {
        usertoken.expires_at=new Date(Date.now() + expireInMins * 60 * 1000)
      }
      //expireInSecs
      //console.log('addUnconstrainedAPIUserToken creating localUserToken', JSON.parse(JSON.stringify(usertoken)))
      /*usertoken.save(function() {
        callback(usertoken, null)
      })*/
      // this will call callback if set
      db_insert(usertoken, localUserTokenModel, callback)
    })
  },
  createOrFindUserToken: function(userid, client_id, scopes, callback) {
    //console.log('createOrFindUserToken', userid, client_id, scopes)
    if (userid === undefined) {
      return callback(false, 'no userid')
    }
    if (client_id === undefined) {
      return callback(false, 'no client_id')
    }
    if (scopes===undefined) scopes=''
    localUserTokenModel.findOne({ where: { userid: userid, client_id: client_id }}, function(err, usertoken) {
      if (usertoken) {
        //console.log('createOrFindUserToken found token', usertoken)
        // maybe a timestamp of lastIssued
        usertoken.scopes=scopes
        //usertoken.token=token
        usertoken.save()
        // check scopes
        // do we auto upgrade scopes?
        // probably should just fail
        if (callback) {
          callback(null, usertoken)
        }
        return
      }
      // no token
      //console.log('no token')
      function genCheckToken(cb) {
        var token=generateToken(98)
        // console.log('is', token, 'used')
        // console.log('genCheckToken token', token)
        localUserTokenModel.findOne({ where: { token: token }}, function(err, tokenUnique) {
          if (err) console.error('localUserTokenModel find', token, 'err', err)
          if (tokenUnique) {
            // try again
            genCheckToken(cb)
          } else {
            //console.log('genCheckToken returning token', token)
            cb(err, token)
          }
        })
      }
      genCheckToken(function(err, token) {
        if (err) console.error('dataaccess.caminte.js::createOrFindUserToken - genCheckToken err', err)
        var usertoken=new localUserTokenModel
        usertoken.userid=userid
        usertoken.client_id=client_id
        usertoken.scopes=scopes
        usertoken.token=token
        // console.log('dataaccess.caminte.js::createOrFindUserToken - creating localUserToken', JSON.parse(JSON.stringify(usertoken)))
        /*usertoken.save(function() {
          callback(usertoken, null)
        })*/
        //console.log('createOrFindUserToken made token', usertoken)
        // this will call callback if set
        db_insert(usertoken, localUserTokenModel, callback)
      })
    })
  },
  delAPIUserToken: function(token, callback) {
    localUserTokenModel.findOne({ where: { token: token } }, function(err, usertoken) {
      localUserTokenModel.destroyById(usertoken.id, callback)
    })
  },
  // should only be used by the admin API
  getAPITokenByUsername: function(username, callback) {
    //console.log('dataaccess.camintejs.js::getAPITokenByUsername - username:', username)
    if (username==undefined) {
      console.trace('dataaccess.camintejs.js::getAPITokenByUsername - username not defined')
      if (callback) callback('username undefined')
      return
    }
    this.getUserID(username, function(err, user) {
      if (err) console.error('dataaccess.caminte.js::getAPITokenByUsername - err', err)
      if (!user) {
        return callback(err, false)
      }
      localUserTokenModel.findOne({ where: { userid: user.id }, limit: 1 }, function(err, usertoken) {
        if (err) {
          console.log('dataaccess.camintejs.js::getAPITokenByUsername - err', err, 'usertoken', usertoken)
        }
        //console.log('dataaccess.camintejs.js::getAPITokenByUsername - found:', usertoken)
        callback(err, usertoken)
      })
    })
  },
  getAPIUserToken: function(token, callback) {
    // console.log('dataaccess.camintejs.js::getAPIUserToken - Token:', token)
    if (token==undefined) {
      //console.log('dataaccess.camintejs.js::getAPIUserToken - Token not defined')
      // we shouldn't need to return here
      // why doesn't mysql handle this right? bad driver
      callback(false, 'token undefined')
      return
    }
    //console.log('dataaccess.camintejs.js::getAPIUserToken - token:', token)
    // error but must have been connected because it could still get counts
/*
dispatcher @1494199287183 Memory+[803.9 k] Heap[23.44 M] uptime: 298756.005
dataaccess.caminte.js::status 19U 44F 375P 0C 0M 0s 77/121i 36a 144e
TypeError: Cannot read property 'model' of undefined
    at MySQL.BaseSQL.table (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/sql.js:27:31)
    at MySQL.BaseSQL.tableEscaped (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/sql.js:35:33)
    at MySQL.all (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/adapters/mysql.js:444:53)
    at Function.all (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/abstract-class.js:510:29)
    at Function.findOne (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/caminte/lib/abstract-class.js:592:18)
    at Object.getAPIUserToken (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/dataaccess.caminte.js:871:25)
    at Object.getAPIUserToken (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/dataaccess.base.js:90:17)
    at Object.getUserClientByToken (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/dispatcher.js:1577:16)
    at Layer.handle (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/app.cluster.js:262:22)
    at trim_prefix (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:230:15)
    at /tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:198:9
    at Function.proto.process_params (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:253:12)
    at next (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:189:19)
    at Layer.handle (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/connect-busboy/index.js:14:14)
    at trim_prefix (/tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:230:15)
    at /tank/Users/rtharp/Sites/adn/AppDotNetAPI/node_modules/express/lib/router/index.js:198:9

dispatcher @1494199347200 Memory+[502.68 k] Heap[23.94 M] uptime: 298816.022
dataaccess.caminte.js::status 19U 44F 375P 0C 0M 0s 77/121i 36a 144e

dispatcher @1494199407211 Memory+[833.86 k] Heap[24.78 M] uptime: 298876.034
dataaccess.caminte.js::status 19U 44F 375P 0C 0M 0s 77/121i 36a 144e
*/
    // what if there more than one?
    // if we get more than one, than we callback multiple times?
    localUserTokenModel.findOne({ where: { token: token }, limit: 1 }, function(err, usertoken) {
      if (err) {
        console.log('dataaccess.camintejs.js::getAPIUserToken - err', err, 'usertoken', usertoken)
      }
      // console.log('dataaccess.camintejs.js::getAPIUserToken - found:', usertoken)
      callback(err, usertoken)
    })
  },
  /*
   * user upstream tokens
   */
  setUpstreamUserToken: function(userid, token, scopes, callback) {
    upstreamUserTokenModel.findOne({ where: { userid: userid } }, function(err, upstreamToken) {
      if (err) {
        console.log('dataaccess.camintejs.js::setUpstreamUserToken - upstreamUserTokenModel err', err)
        if (callback) {
          callback(upstreamToken, err)
          return
        }
      }
      if (upstreamToken) {
        if (upstreamToken.token!=token) {
          console.log('dataaccess.camintejs.js::setUpstreamUserToken - new token?', token, 'old', upstreamToken.token)
        }
      } else {
        upstreamToken=new upstreamUserTokenModel
        upstreamToken.userid=userid
      }
      // update token and scopes for this user
      upstreamToken.scopes=scopes
      upstreamToken.token=token
      upstreamToken.save(function() {
        if (callback) {
          callback(upstreamToken, user)
        }
      })
    })
  },
  delUpstreamUserToken: function(token) {
    console.log('dataaccess.camintejs.js::delUpstreamUserToken - write me!')
  },
  getUpstreamUserToken: function(userid, callback) {
    upstreamUserTokenModel.findOne({ where: { userid: userid } }, function(err, upstreamToken) {
      if (err) {
        console.log('dataaccess.camintejs.js::setUpstreamUserToken - upstreamUserTokenModel err', err)
        if (callback) {
          callback(upstreamToken, err)
          return
        }
      }
      callback(upstreamToken, null)
    })
  },
  /* client (app) tokens */
  addAPIAppToken: function(client_id, token, request) {
    console.log('api_persistent_storage::addAPIAppToken - write me!')
  },
  delAPIAppToken: function(client_id, token) {
    console.log('api_persistent_storage::delAPIAppToken - write me!')
  },
  getAPIAppToken: function(client_id, token) {
    console.log('api_persistent_storage::getAPIAppToken - write me!')
  },
  /* client upstream token */
  addUpstreamClientToken: function(token, scopes) {
    console.log('api_persistent_storage::addUpstreamClientToken - write me!')
  },
  delUpstreamClientToken: function(token) {
    console.log('api_persistent_storage::delUpstreamClientToken - write me!')
  },
  getUpstreamClientToken: function() {
    console.log('api_persistent_storage::getUpstreamClientToken - write me!')
  },
  /** app stream */
  getExplore: function(params, callback) {
    if (this.next) {
      this.next.getExplore(params, callback)
    } else {
      //console.log('dataaccess.base.js::getExplore - write me!')
      var res={"meta":{"code":200},
        "data":[
          {"url":"/posts/stream/explore/conversations", "description":"New conversations just starting on App.net", "slug":"conversations", "title":"Conversations"},
          {"url":"/posts/stream/explore/photos", "description":"Photos uploaded to App.net", "slug":"photos", "title":"Photos"},
          {"url":"/posts/stream/explore/trending", "description":"Posts trending on App.net", "slug":"trending", "title":"Trending"},
          //{"url":"/posts/stream/explore/checkins", "description":"App.net users in interesting places", "slug":"checkins", "title":"Checkins"}
          //{"url":"/posts/stream/explore/subtweets", "description":"memes", "slug":"subtweets", "title":"Drybones Subtweets"}
          {"url":"/posts/stream/explore/moststarred", "description":"Posts that people have starred", "slug":"moststarred", "title":"Starred Posts"}
        ]
      }
      callback(res.data, null, res.meta)
    }
  },
  getExploreFeed: function(feed, params, callback) {
    //console.log('dataaccess.camtinte.js::getExploreFeed(', feed, ',..., ...) - start')
    if (this.next) {
      this.next.getExploreFeed(feed, params, callback)
    } else {
      // get list of posts && return
      var posts=[]
      var ref=this
      switch(feed) {
        case 'photos':
          annotationModel.find({ where: { idtype: 'post', type: 'net.app.core.oembed' }, order: 'typeid DESC' }, function(err, dbNotes) {
            if (!dbNotes.length) callback(posts, null, { "code": 200 })
            var posts = []
            for(var i in dbNotes) {
              posts.push(dbNotes[i].typeid)
            }
            var maxid=0
            applyParams(postModel.find().where('id', { in: posts }), params, maxid, callback)
          })
        break
        case 'checkins':
          // we need to convert to applyParams
          annotationModel.find({ where: { idtype: 'post', type: 'ohai' }, order: 'typeid DESC' }, function(err, dbNotes) {
            if (!dbNotes.length) callback(posts, null, { "code": 200 })
            for(var i in dbNotes) {
              ref.getPost(dbNotes[i].typeid, function(post, err, meta) {
                posts.push(post)
                //console.log(posts.length, '/', dbNotes.length)
                if (posts.length===dbNotes.length) {
                  callback(posts, null, { "code": 200 })
                }
              })
            }
          })
        break
        case 'moststarred':
          // so "conversations", is just going to be a list of any posts with a reply (latest at top)
          // maybe the thread with the latest reply would be good
          // params.generalParams.deleted <= defaults to true
          var maxid=0
          // get the highest post id in posts
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            //console.log('dataaccess.caminte.js::getUserPosts - back',posts)
            if (posts.length) {
              maxid=posts[0].id
            }
            console.log('dataaccess.caminte.js::moststarred - max', maxid)
            // order is fucked here...
            applyParams(postModel.find().where('num_stars', { ne: 0 }).order('num_stars DESC, id DESC'), params, maxid, function(dbPosts, err, meta) {
              /*
              if (!dbPosts.length) {
                callback(dbPosts, null, { "code": 200 })
              }
              */
              callback(dbPosts, null, { "code": 200 })
            })
          })
        break
        case 'conversations':
          // so "conversations", is just going to be a list of any posts with a reply (latest at top)
          // maybe the thread with the latest reply would be good
          // params.generalParams.deleted <= defaults to true
          var maxid=0
          // get the highest post id in posts
          postModel.all({ order: 'id DESC', limit: 1}, function(err, posts) {
            //console.log('dataaccess.caminte.js::getUserPosts - back',posts)
            if (posts.length) {
              maxid=posts[0].id
            }
            console.log('dataaccess.caminte.js::conversations - max', maxid)
            // this alone makes the order much better but not perfect
            applyParams(postModel.find().where('reply_to', { ne: 0}).order('thread_id DESC'), params, maxid, function(dbPosts, err, meta) {
            //postModel.find({ where: { reply_to: { ne: 0 } }, order: 'thread_id DESC' }, function(err, dbPosts) {
              if (!dbPosts.length) callback(dbPosts, null, { "code": 200 })
              var started={}
              var starts=0
              var dones=0
              for(var i in dbPosts) {
                if (started[dbPosts[i].thread_id]) continue
                started[dbPosts[i].thread_id]=true
                starts++
                ref.getPost(dbPosts[i].thread_id, function(post, err, meta) {
                  posts.push(post)
                  dones++
                  //console.log(posts.length, '/', dbNotes.length)
                  //if (posts.length===dbPosts.length) {
                  if (starts===dones) {
                    // FIXME: order
                    callback(posts, null, { "code": 200 })
                  }
                })
              }
            })
          })
        break
        case 'trending':
          // so "trending" will be posts with hashtags created in the last 48 hours, sorted by most replies
          entityModel.find({ where: { idtype: 'post', type: 'hashtag' }, order: 'typeid DESC' }, function(err, dbEntities) {
            if (!dbEntities.length) callback(posts, null, { "code": 200 })
            var posts = []
            for(var i in dbEntities) {
              posts.push(dbEntities[i].typeid)
            }
            var maxid=0
            applyParams(postModel.find().where('id', { in: posts }), params, maxid, callback)
            /*
            var started={}
            var starts=0
            var dones=0
            for(var i in dbEntities) {
              if (started[dbEntities[i].typeid]) continue
              started[dbEntities[i].typeid]=true
              starts++
              ref.getPost(dbEntities[i].typeid, function(post, err, meta) {
                posts.push(post)
                dones++
                if (starts===dones) {
                  callback(posts, null, { "code": 200 })
                }
              })
            }
            */
          })
        break
        case 'subtweets':
          postModel.find({ where: { text: { like: '%drybones%' } }, order: 'id DESC' }, function(err, dbPosts) {
            if (!dbPosts.length) callback(posts, null, { "code": 200 })
            for(var i in dbPosts) {
              ref.getPost(dbPosts[i].id, function(post, err, meta) {
                posts.push(post)
                //console.log(posts.length, '/', dbNotes.length)
                if (posts.length===dbPosts.length) {
                  callback(posts, null, { "code": 200 })
                }
              })
            }
          })
        break
        default:
          console.log('dataaccess.caminte.js::getExploreFeed(', feed, ') - No such feed (write it?)')
          callback(posts, null, { "code": 200 })
        break
      }
    }
  },
  // user: userid
  addNotice: function(notice, callback) {
    db_insert(notice, noticeModel, callback)
  },
  delNotice: function(query, callback) {
    noticeModel.find(query, function(err, noticies) {
      for(var i in noticies) {
        var notice=noticies[i]
        notice.destroy(function(err) {
        })
      }
      if (callback) callback()
    })
  },
  getNotices: function(user, params, tokenObj, callback) {
    //console.log('dataaccess.caminte.js::getNotices - user', user, 'params', params, 'tokenObj', typeof(tokenObj), 'callback', typeof(callback))
    /*
    if (typeof(callback)!=='function') {
      console.log('dataaccess.caminte.js::getNotices - called without a callback', user, params, tokenObj)
      return
    }
    */
    var ref = this
    function finalfunc(userid) {
      var query = noticeModel.find().where('notifyuserid', userid)
      if (tokenObj.userid) {
        ref.getAllMutesForUser(tokenObj.userid, function(err, mutedUserIDs) {
          query=query.where('actionuserid', { nin: mutedUserIDs })
          //console.log('getChannelMessages - params', params)
          applyParams(query, params, callback)
        })
      } else {
        applyParams(query, params, callback)
      }

      /*
      applyParams(query, params, 0, function(notices, err, meta) {
        callback(notices, err, meta)
      })
      */

      // , limit: params.count
      /*
      noticeModel.find({ where: { notifyuserid: userid }, order: "event_date DESC" }, function(err, notices) {
        //console.log('dataaccess.caminte.js::gotNotices')
        callback(notices, err)
      })
      */
    }

    // FIXME: move this shit into the dispatcher
    if (user=='me') {
      //this.getAPIUserToken(tokenStr, function(tokenobj, err) {
      finalfunc(tokenObj.userid)
      //})
    } else if (user[0]=='@') {
      // uhm I don't think posts has a username field...
      this.getUserID(user.substr(1), function(err, userobj) {
        finalfunc(userobj.id)
      })
    } else {
      finalfunc(user)
    }
  },
  addEmpty: function(empty, callback) {
    emptyModel.create(empty, callback)
  },
  findEmpty: function(type, id, callback) {
    emptyModel.findOne({ where: { type: type, typeid: id } }, callback)
  },
  getOEmbed: function(url, callback) {
    if (this.next) {
      this.next.getOEmbed(url, callback)
    } else {
      var info = {
        meta: {
          code: 200
        },
        data: {}
      }

      var ref = this
      // A URL for a post or photo on App.net.
      var alpha = url.match(/alpha.tavrn.gg/i)
      if (alpha) {
        var parts = url.split('/')
        // post vs photo?
        var type = 'post'
        if (url.match(/\/photo\//)) {
          type = 'photo'
          var postid = parts[parts.length - 3]
          var photoid = parts[parts.length - 1]
          console.log('dataaccess.camtine.js::getOEmbed -photo mode', postid, photoid)
          this.getAnnotations('post', postid, function(notes, err) {
            //console.log('post info', notes)
            var c = 0
            for(var i in notes) {
              var note = notes[i]
              if (note.type == 'net.app.core.oembed') {
                console.log('dataaccess.camtine.js::getOEmbed - found our info', note.value)
                c ++
                if (c == photoid) {
                  info.data = JSON.parse(note.value)
                  break
                }
              }
            }
            callback(info, null)
          })
          return
        }
        var postid = parts[parts.length - 1]
        console.log('dataaccess.camtine.js::getOEmbed - postid', postid)
        this.getPost(postid, function(post, err) {
          //console.log('post info', post)
          info.data = {
            provider_url: "https://tavrn.gg",
            version: "1.0",
            author_url: "https://tavrn.gg/u/"+post.userid,
            title: post.text,
            url: "https://tavrn.gg/u/"+post.userid+"/post/"+post.userid,
            provider_name: "Tavrn.gg",
            type: "link",
            html: post.html,
            author_name: post.userid
          }
          callback(info, null)
        })
      } else {
        callback(null, null)
      }
      //callback(null, null)
      //console.log('dataaccess.caminte.js::getOEmbed - write me!')
      // <link rel="alternate" type="application/json+oembed"
      // href="http://example.com/services/oembed?url=http%3A%2F%2Fexample.com%2Ffoo%2F&amp;format=json"
      // title="oEmbed Profile: JSON">
      // <link rel="alternate" type="application/json+oembed" href="http://api.sapphire.moe/oembed?url=http://alpha.tavrn.gg/marcodiazclone/post/607" title="App.net oEmbed" />
      /*
      request(url, function(err, resp, body) {
        var linkFilter = new RegExp('<link([^>]+)>','img')
        var links = body.match(linkFilter)
        if (links) {
          for(var i=0,imax=links.length; i<imax; i++) {
            var link = links[i]
            //console.log('link', link)
            if (link.match(/type=['"]application\/json\+oembed['"]/i)) {
              //console.log('oembed link', link)
              if (link.match(/rel=['"]alternate["']/i)) {
                //console.log('alt oembed link', link)
                var href = link.match(/href=["']([^"']+)["']/i)
                var oembedUrl = href[1]
                console.log('href', oembedUrl)
                request(oembedUrl, function(err, resp, body) {
                  console.log('body', body)
                  callback(JSON.parse(body), null)
                })
              }
            }
          }
        }
      })
      */
      /*
      oembedTools.extract(url).then((data) => {
        console.log('url', url, 'data', data)
        callback(data, null)
      }).catch((err) => {
        console.log('oembed err', err)
        callback('', 'no provider')
      })
      */
    }
  }
}

funcs.forEach((func) => {
  functions = Object.assign(functions, func)
})

module.exports = functions
module.exports.next = null
module.exports.start = start
