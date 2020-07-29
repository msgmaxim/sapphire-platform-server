var annotationModel

function start(options) {
  const schemaData = options.schemaData
  /** annotation storage model */
  annotationModel = schemaData.define('annotation', {
    idtype: { type: String, index: true }, // user, post, channel, message
    typeid: { type: Number, index: true }, // causing problems?
    type: { type: String, length: 255, index: true },
    value:  { type: schemaData.JSON },
  })
}

module.exports = {
  next: null,
  start: start,
  /**
   * Annotations
   */
  addAnnotation: function(idtype, id, type, value, callback) {
    note=new annotationModel
    note.idtype=idtype
    note.typeid=id
    note.type=type
    note.value=value
    note.save(function(err) {
      callback(err, note)
    })
    //db_insert(note, annotationModel, callback)
  },
  clearAnnotations: function(idtype, id, callback) {
    //console.log('dataaccess.caminte.js::clearAnnotations - idtype', idtype, 'id', id)
    annotationModel.remove({where: { idtype: idtype, typeid: id }}, function(err, oldAnnotations) {
      if (callback) {
        callback()
      }
    })
    /*
    annotationModel.find({where: { idtype: idtype, typeid: id }}, function(err, oldAnnotations) {
      for(var i in oldAnnotations) {
        var oldNote=oldAnnotations[i]
        // causes TypeError: Cannot read property 'constructor' of null
        // when using by id... ah I see wrong type of id...
        if (oldNote.id) {
          annotationModel.destroyById(oldNote.id, function(err) {
            if (err) {
              console.log('couldn\'t destory old annotation ', err)
            }
          })
        } else {
          //console.log('dataaccess.caminte.js::clearAnnotations - OldNote doesn\'t have id ',oldNote)
        }
      }
      if (callback) {
        callback()
      }
    })
    */
  },
  getAnnotations: function(idtype, id, callback) {
    // Todo: implement this.next calling
    /*
    if (this.next) {
      this.next.getAnnotations(idtype, id, callback)
    }
    */
    annotationModel.find({where: { idtype: idtype, typeid: id }}, callback)
  },
  searchAnnotationByType: function(idtype, type, order, callback) {
    annotationModel.find({ where: { idtype: idtype, type: type }, order: order }, callback)
  }
}
