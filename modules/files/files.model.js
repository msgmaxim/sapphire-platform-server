var fileModel

var applyParams

function start(modelOptions) {
  applyParams = modelOptions.applyParams
  /** file storage model */
  fileModel = modelOptions.schemaData.define('file', {
    /* API START */
    userid: { type: Number, index: true },
    created_at: { type: Date },
    client_id: { type: String, length: 32 },
    kind: { type: String, length: 255, index: true },
    name: { type: String, length: 255 },
    type: { type: String, length: 255, index: true }, // com.example.test
    complete: { type: Boolean },
    sha1: { type: String, length: 255 },
    url: { type: String, length: 512 },
    total_size: { type: Number },
    size: { type: Number },
    mime_type: { type: String, length: 255 },
    urlexpires: { type: Date },
    /* API END */
    last_updated: { type: Date },
  })
}

module.exports = {
  next: null,
  start: start,
  /** files */
  addFile: function(file, token, callback) {
    // if we local commit, do we also want to relay it upstream?
    if (this.next) {
      this.next.addFile(file, token, callback)
    } else {
      // if no next, then likely no upstream
      file.last_updated=new Date()
      // deal with caminte short coming on mysql
      //file.type=file.type.replace(new RegExp('\\.', 'g'), '_')
      console.log('final pre file model', file)
      //file.token=randomstring(173)
      // network client_id
      // but since there's no uplink
      // our local is the network tbh
      // already done in dialect
      //ipost.client_id=tokenObj.client_id
      if (file.urlexpires === undefined) file.urlexpires=new Date(0)
      if (file.sha1 === undefined) file.sha1=''
      fileModel.create(file, callback);
    }
  },
  setFile: function(file, del, ts, callback) {
    if (del) {
      fileModel.destroyById(file.id, callback)
    } else {
      //file.type=file.type.replace(new RegExp('\\.', 'g'), '_')
      fileModel.findOrCreate({
        id: file.id
      },file, function(err, ofile) {
        //ofile.type=ofile.type.replace(new RegExp('_', 'g'), '.')
        if (callback) {
          callback(ofile, err)
        }
      })
    }
  },
  getFile: function(fileId, callback) {
    //console.log('dataaccess.caminte.js::getFile - id is '+id)
    if (fileId == undefined) {
      callback(null, 'dataaccess.caminte.js::getFile - id is undefined')
      return
    }
    var ref=this
    fileModel.findById(fileId, function(err, file) {
      //console.log('dataaccess.caminte.js::getFile - post, err',post,err)
      if (file==null && err==null) {
        //console.log('dataaccess.caminte.js::getFile - next?',ref.next)
        if (ref.next) {
          //console.log('dataaccess.caminte.js::getFile - next')
          ref.next.getFile(fileId, callback)
          return
        }
      }
      callback(file, err)
    })
  },
  getFiles: function(userid, params, callback) {
    var query = fileModel.find().where('userid', userid)
    //query.debug = true
    applyParams(query, params, callback)
  },
}
