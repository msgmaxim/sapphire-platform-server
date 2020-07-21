module.exports = {
  /** files */
  fileToAPI: function(file, params, token, callback) {
    var api={
      complete: file.complete, // only allow completed files atm
      created_at: file.created_at,
      derived_files: {},
      file_token: file.url,
      id: file.id,
      image_info: {
        width: 600,
        height: 800
      },
      kind: file.kind,
      mime_type: file.mime_type,
      name: file.name,
      sha1: file.sha1,
      size: file.size,
      //source (file.client_id
      total_size: file.size, // should include all derived_files
      type: file.type,
      url: file.url,
      //url_expires
      //user
    }
    function checkDone() {
      if (api.user && api.source) {
        callback(null, api)
      }
    }
    this.getUser(file.userid, params, function(userErr, user, userMeta) {
      if (userErr) console.error('files.controller.js::fileToAPI - getUser err', userErr)
      api.user = user
      checkDone()
    })
    this.getClient(file.client_id, function(clientErr, source, clientMeta) {
      if (clientErr) console.error('files.controller.js::fileToAPI - getClient err', clientErr)
      api.source = source
      checkDone()
    }, false) // don't need to add if d.n.e.
  },
  getFile: function(fileid, params, callback) {
    console.log('dispatcher.js::getFile - write me!')
    callback(null, null)
  },
  getFiles: function(userid, params, callback) {
    //console.log('dispatcher.js::getFiles - for user', userid, params)
    var ref=this
    this.cache.getFiles(userid, params, function(err, dbFiles, meta) {
      if (err) console.error('files.controller.js::getFiles - err', err)
      if (!dbFiles.length) {
        callback(false, [])
      }
      var files=[]
      for(var i in dbFiles) {
        ref.fileToAPI(dbFiles[i], params, { userid: userid }, function(err, api) {
          if (err) console.error('files.controller.js::getFiles - fileToAPI err', err)
          files.push(api)
          if (files.length === dbFiles.length) {
            callback(err, files, meta)
          }
        })
      }
    })
  },
  addFile: function(apiFile, tokenObj, params, callback) {
    // so translate ADN file object stuffs into fileModel
    var file=apiFile
    file.userid=tokenObj.userid
    file.client_id=tokenObj.client_id
    file.complete=true // very true if we have a url
    file.total_size=file.size
    file.created_at=new Date()
    var ref=this
    this.cache.addFile(file, tokenObj, function(err, dbFile, meta) {
      if (err) console.error('files.controller.js::addFile - err', err)
      // and convert back
      ref.fileToAPI(dbFile, params, tokenObj, callback)
      /*
      var resFile=dbFile
      // probably can be optimized out
      ref.getUser(dbFile.userid, { tokenobj: tokenObj }, function(user, userErr, userMeta) {
        resFile.user=user
        // could also dab client obj but who needs that...
        // need to return
        // id: numeric
        // file_token: auCj3h64JZrhQ9aJdmwre3KP-QL9UtWHYvt5tj_64rUJWemoIV2W8eTJv9NMaGpBFk-BbU_aWA26Q40w4jFhiPBpnIQ_lciLwfh6o8YIAQGEQziksUMxZo7gOHJ_-niw3l3MZCh7QRWzqNGpiVaUEptfKO0fETrZ8bJjDa61234a
        callback(resFile, err, meta)
      })
      */
    })
  },
  setFile: function(data, deleted, id, ts, callback) {
    // map data onto model
    if (data.user) {
      this.updateUser(data.user)
    }
    var file=data
    if (deleted) {
      file.id=id // we need this for delete
    }
    file.userid=data.user.id
    // client_id?
    // data.source handling...
    this.cache.setFile(data, deleted, id, callback)
    // file annotations are this mutable
    // if so we need to make sure we only update if timestamp if newer
    /*
      if (data.annotations) {
        ref.setAnnotations('file', data.id, data.annotations)
      }
    */
  },
}
