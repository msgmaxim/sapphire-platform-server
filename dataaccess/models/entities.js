var entityModel

function start(schemaData) {
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
      this.next.extractEntities(type, id, entities, entitytype, callback);
    }
    */
    if (type===null) {
      // don't let it write type nulls
      console.log('dataaccess.caminte.js::extractEntities - extracted bad entity type',type);
      callback(null,'badtype');
      return;
    }
    // delete (type & idtype & id)
    entityModel.find({where: { idtype: type, typeid: id, type: entitytype }},function(err, oldEntities) {
      //console.dir(oldEntities);

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
        var oldEntity=oldEntities[i];
        if (oldEntity.id) {
          entityModel.destroyById(oldEntity.id, function(err) {
            if (err) {
              console.log('couldn\'t destroy old entity ',err);
            }
          });
        } else {
          //console.log('dataaccess.caminte.js::extractEntities - OldEntity doesn\'t have id ',oldEntity);
        }
      }
      // delete all oldEntities
      //console.log('uploading '+entities.length+' '+type+' '+entitytype);
      // foreach entities
      for(var i in entities) {
        //console.dir(entities[i]);
        // insert
        // ok we don't want to copy/reference here, this stomps id
        entity=new entityModel(entities[i]);
        // well maybe if we clean up well enough
        entity.id=null;
        entity.typeid=id;
        entity.idtype=type;
        entity.type=entitytype;
        entity.text=entities[i].name?entities[i].name:entities[i].text;
        entity.alt=entities[i].url?entities[i].url:entities[i].id;
        entity.altnum=entities[i].is_leading?entities[i].is_leading:entities[i].amended_len;
        if (!entity.alt) {
          entity.alt='';
        }
        if (!entity.altnum) {
          entity.altnum=0;
        }
        //console.log('Insert entity '+entitytype+' #'+i+' '+type,'alt',entity.alt,'userid',entities[i].id);
        db_insert(entity, entityModel);
      }
      if (callback) {
        callback(null, null);
      }
    });

  },
  getEntities: function(type, id, callback) {
    //console.log('type: '+type+' id: '+id);
    if (!type) {
      console.log('dataaccess.caminte.js::getEntities - type', type, 'id', id);
      console.trace('dataaccess.caminte.js::getEntities - no type');
      callback([], 'invalid type', {
        code: 500
      });
      return;
    }
    if (!id) {
      console.log('dataaccess.caminte.js::getEntities - type', type, 'id', id);
      console.trace('dataaccess.caminte.js::getEntities - no id');
      callback([], 'invalid type', {
        code: 500
      });
      return;
    }
    var res={
      mentions: [],
      hashtags: [],
      links: [],
    };
    // count is always 0 or 1...
    // with find or all
    var ref=this;
    entityModel.find({ where: { idtype: type, typeid: id } }, function(err, entities) {
      if (entities==null && err==null) {
        if (ref.next) {
          ref.next.getEntities(type, id, callback);
          return;
        }
      } else {
        //console.log('dataaccess.caminte.js::getEntities '+type+' '+id+' - count ',entities.length);
        for(var i in entities) {
          var entity=entities[i];
          // why is find returning empty sets...
          if (entity.id===null) continue;
          //console.log('entity',entity,'i',i);
          //console.log('et '+entity.type);
          if (res[entity.type+'s']) {
            res[entity.type+'s'].push(entities[i]);
          } else {
            // temp disabled, just makes debugging other things harder
            // you're data is bad I get it
            console.log('getEntities unknown type ['+entity.type+'] for ['+type+'] ['+id+'] test['+entity.id+']');
            // we need to delete it
            //entity.destroy();
            //entityModel.destroy(entity);
            entityModel.destroyById(entity.id);
          }
        }
      }
      callback(res, null);
    });
  },
  // more like getHashtagEntities
  getHashtagEntities: function(hashtag, params, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.getHashtagEntities(hashtag, params, callback);
    }
    */
    // sorted by post created date...., well we have post id we can use
    entityModel.find({ where: { type: 'hashtag', text: hashtag }, order: 'typeid DESC' }, function(err, entities) {
      callback(entities, err);
    });
  },
}
