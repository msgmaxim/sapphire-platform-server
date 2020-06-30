var clientModel

function start(options) {
  const schemaData = options.schemaData
  // local clients (upstream is set in config and we can only have one upstream)
  /** client storage model */
  clientModel = schemaData.define('client', {
    client_id: { type: String, limit: 32, index: true }, // probably should be client_id
    secret: { type: String, limit: 32 },
    userid: { type: Number },
    name: { type: String, limit: 255 },
    link: { type: String, limit: 255 },
    accountid: { type: Number, index: true },
  })
  /*
    client_id: { type: String, length: 32, index: true },
    secret: { type: String, length: 255 },
    shortname: { type: String, length: 255 },
    displayname: { type: String, length: 255 },
  */
  clientModel.validatesUniquenessOf('client_id', {message:'client_id is not unique'})
}

module.exports = {
  next: null,
  start: start,
  /*
   * network clients?
   */
  addSource: function(client_id, name, link, callback) {
    var client=new clientModel;
    client.client_id=client_id;
    client.name=name;
    client.link=link;
    client.save(function(err) {
      callback(err, client);
    })
  },
  getClient: function(client_id, callback) {
    clientModel.findOne({ where: {client_id: client_id} }, function(err, client) {
      if (client) {
        delete client.secret;
      }
      callback(client, err);
    });
  },
  setSource: function(source, callback) {
    clientModel.findOrCreate({
      client_id: source.client_id
    }, {
      name: source.name,
      link: source.link
    }, function(err, client) {
      delete client.secret
      callback(client, err);
    });
  },
}
