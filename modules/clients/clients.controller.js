module.exports = {
  /** client */
  getSource: function(source, callback) {
    if (source==undefined) {
      callback(null, 'source is undefined')
      return
    }
    //console.dir(source)
    var ref=this.cache
    console.log('clients.controller.js::getSource ', source.client_id)
    this.cache.getClient(source.client_id, function(err, client, meta) {
      if (client==null || err) {
        //console.log('dispatcher.js::getSource failure ', err, client)
        // we need to create it
        ref.addSource(source.client_id, source.name, source.link, callback)
      } else {
        callback(err, client, meta)
      }
    })
    if (this.notsilent) {
      process.stdout.write('c')
    }
  },
  getClient: function(client_id, callback, shouldAdd) {
    if (client_id==undefined) {
      callback('client_id is undefined')
      return
    }
    if (client_id==null) {
      callback('client_id is null')
      return
    }
    var ref=this.cache
    //console.log('dispatcher.js::getClient', client_id)
    this.cache.getClient(client_id, function(err, client, meta) {
      if (err) console.error('clients.controller.js::getClient - err', err)
      if (client) {
        delete client.secret // don't expose the secret!
      }
      if (client==null) {
        //console.log('clients.controller.js::getClient - no such client', client_id)
        // should we just be setClient??
        if (shouldAdd) {
          console.log("clients.controller.js::getClient - Should add client_id: "+client_id, shouldAdd)
          //var source={ client_id: client_id, name: ??, link: ?? }
          //ref.setSource()
        }
        // make dummy
        var client={
          name: 'Unknown',
          link: 'nowhere',
          client_id: client_id
        }
      }
      callback(err, client, meta)
    })
  },
}
