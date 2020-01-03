var entityModel

var applyParams

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  schemaData = modelOptions.schemaData
  // total cache table (since I think we can extract from text),
  // we'll have an option to omitted its use
  // though we need it for hashtag look ups
  /** entity storage model */
  entityModel = schemaData.define('entity', {
    idtype: { type: String, length: 16, index: true }, // user, post, channel, message
    typeid: { type: Number, index: true }, // causing problems?
    type: { type: String, length: 16, index: true }, // link, hashtag, mention
    pos: { type: Number },
    len: { type: Number },
    text: { type: String, length: 255, index: true }, // hashtag is stored here
    alt: { type: String, length: 255, index: true },
    altnum: { type: Number },
  })
}

module.exports = {
  next: null,
  start: start,
  /** entities */
  // should this model more closely follow the annotation model?
  // not really because entities are immutable (on posts not users)
  extractEntities: function(type, id, entities, entitytype, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.extractEntities(type, id, entities, entitytype, callback)
    }
    */
    if (type===null) {
      // don't let it write type nulls
      console.error('dataaccess.caminte.js::extractEntities - extracted bad entity type', type)
      callback('badtype', false)
      return
    }
    // delete (type & idtype & id)
    entityModel.find({where: { idtype: type, typeid: id, type: entitytype }}, function(err, oldEntities) {
      //console.dir(oldEntities)

      // why do we have empty entity records in the DB?
      /*
        dataaccess.caminte.js::extractEntities - OldEntity doesn't have id  { idtype: null,
          typeid: null,
          type: null,
          pos: null,
          len: null,
          text: null,
          alt: null,
          altnum: null,
          id: null }
      */
      // I think find returns an empty record if nothing is found...
      // how to test this?

      for(var i in oldEntities) {
        var oldEntity=oldEntities[i]
        if (oldEntity.id) {
          entityModel.destroyById(oldEntity.id, function(err) {
            if (err) {
              console.log('couldn\'t destroy old entity ',err)
            }
          })
        } else {
          //console.log('dataaccess.caminte.js::extractEntities - OldEntity doesn\'t have id ',oldEntity)
        }
      }
      // delete all oldEntities
      //console.log('uploading '+entities.length+' '+type+' '+entitytype)
      // foreach entities
      for(var i in entities) {
        //console.dir(entities[i])
        // insert
        // ok we don't want to copy/reference here, this stomps id
        entity=new entityModel(entities[i])
        // well maybe if we clean up well enough
        entity.id=null
        entity.typeid=id
        entity.idtype=type
        entity.type=entitytype
        entity.text=entities[i].name?entities[i].name:entities[i].text
        entity.alt=entities[i].url?entities[i].url:entities[i].id
        entity.altnum=entities[i].is_leading?entities[i].is_leading:entities[i].amended_len
        if (!entity.alt) {
          entity.alt=''
        }
        if (!entity.altnum) {
          entity.altnum=0
        }
        //console.log('Insert entity '+entitytype+' #'+i+' '+type,'alt',entity.alt,'userid',entities[i].id)
        //db_insert(entity, entityModel)
        entityModel.create(entity, function(err) {
          if (err) {
            console.log('dataaccess.caminte.js::getEntities - err', err)
          }
        })
      }
      if (callback) {
        callback(null, null)
      }
    })

  },
  getEntities: function(type, id, callback) {
    //console.log('type: '+type+' id: '+id)
    if (!type) {
      console.log('dataaccess.caminte.js::getEntities - type', type, 'id', id)
      console.trace('dataaccess.caminte.js::getEntities - no type')
      callback([], 'invalid type', {
        code: 500
      })
      return
    }
    if (!id) {
      console.log('dataaccess.caminte.js::getEntities - type', type, 'id', id)
      console.trace('dataaccess.caminte.js::getEntities - no id')
      callback([], 'invalid type', {
        code: 500
      })
      return
    }
    var res={
      mentions: [],
      hashtags: [],
      links: [],
    }
    // count is always 0 or 1...
    // with find or all
    var ref=this
    entityModel.find({ where: { idtype: type, typeid: id } }, function(err, entities) {
      if (entities==null && err==null) {
        if (ref.next) {
          ref.next.getEntities(type, id, callback)
          return
        }
      } else {
        //console.log('dataaccess.caminte.js::getEntities '+type+' '+id+' - count ',entities.length)
        for(var i in entities) {
          var entity=entities[i]
          // why is find returning empty sets...
          if (entity.id===null) continue
          //console.log('entity',entity,'i',i)
          //console.log('et '+entity.type)
          if (res[entity.type+'s']) {
            res[entity.type+'s'].push(entities[i])
          } else {
            // temp disabled, just makes debugging other things harder
            // you're data is bad I get it
            console.log('getEntities unknown type ['+entity.type+'] for ['+type+'] ['+id+'] test['+entity.id+']')
            // we need to delete it
            //entity.destroy()
            //entityModel.destroy(entity)
            entityModel.destroyById(entity.id)
          }
        }
      }
      callback(false, res)
    })
  },
  // more like getHashtagEntities
  getHashtagEntities: function(hashtag, params, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.getHashtagEntities(hashtag, params, callback)
    }
    */
    // sorted by post created date...., well we have post id we can use
    entityModel.find({ where: { type: 'hashtag', text: hashtag }, order: 'typeid DESC' }, callback)
  },
  getMentions: function(user, params, callback) {
    if (user=='me') {
      callback([], 'cant pass me to dataaccess.getMentions')
      return
    }
    var ref=this
    //var search={ idtype: 'post', type: 'mention' }
    var k='',v=''
    if (user[0]=='@') {
      //search.text=user.substr(1)
      k='text'; v=user.substr(1)
    } else {
      //search.alt=user
      k='alt'; v=user
    }
    var count=params.count
    //console.log('mention/entity search for ',search)
    //console.log('dataaccess.camtine.js::getMentions - mention/entity search for',k, v)
    // , limit: count, order: 'id desc'
    // 41,681,824
    // to
    // 41,686,219
    // faster?? nope
    //postModel.findOne({ where: {}, order: 'id DESC'}, function(err, post) {
    //postModel.find().order('id', 'DESC').limit(1).run({},function(err, posts) {
    //postModel.all().order('id', 'DESC').limit(1).run({},function(err, posts) {
    //console.log('dataaccess.caminte.js::getMentions - start')
    var maxid=0
    // get the highest post id in entities
    /*
    entityModel.all({ order: 'typeid DESC', limit: 1}, function(err, entities) {
      //console.log('dataaccess.caminte.js::getMentions - back',posts)
      if (entities.length) {
        maxid=entities[0].typeid
      }
      */
      //maxid=post.id
      //if (maxid<20) {
        // by default downloads the last 20 posts from the id passed in
        // so use 20 so we don't go negative
        // FIXME: change to scoping in params adjustment
        //maxid=20
      //}
      //console.log('maxid',maxid)
      // this didn't work
      // this does work
      //applyParams(entityModel.find().where(search), params, maxid, callback)
      // this gave error
      //console.log('dataaccess.caminte.js::getMentions - max', maxid)

      var query = entityModel.find().where('idtype', 'post').where('type', 'mention').where(k, v)
      if (params.tokenobj) {
        this.getAllMutedPosts(params.tokenobj.userid, function(err, mutedPostIDs) {
          query=query.where('typeid', { nin: mutedPostIDs })
          //console.log('getChannelMessages - params', params)
          applyParams(query, params, callback)
        })
        /*
        var mutedUserIDs = []
        //muteModel.find({ where: { 'userid': { in: params.tokenobj.userid } } }, function(err, mutes) {
        this.getAllMutesForUser(params.tokenobj.userid, function(err, mutes) {
          for(var i in mutes) {
            mutedUserIDs.push(mutes[i].muteeid)
          }
          postModel.find({ where: { 'userid': { in: mutedUserIDs } } }, function(err, posts) {
            var mutedPostIDs = []
            for(var i in posts) {
              mutedPostIDs.push(posts[i].id)
            }
            query=query.where('typeid', { nin: mutedPostIDs })
            //console.log('getChannelMessages - params', params)
            applyParams(query, params, callback)
          })
        })
        */
      } else {
        applyParams(query, params, callback)
      }
      //applyParams(entityModel.find().where('idtype', 'post').where('type', 'mention').where(k, v),
        //params, callback)

    //})
    /*
    entityModel.find({ where: search, limit: count, order: 'id DESC' }, function(err, entities) {
      callback(entities.reverse(), err)
    })
    */
  },
}
