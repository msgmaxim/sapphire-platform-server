var fs = require('fs');

module.exports=function(app, prefix) {
  //var dispatcher=app.dispatcher;
  // set cache based on dispatcher object
  var cache = app.dispatcher.cache;
  var nconf = app.nconf;

  var api_client_id= nconf.get('web:api_client_id') || '';
  var upstream_client_id=nconf.get('uplink:client_id') || 'NotSet';

  app.get('/signup', function(req, resp) {
    fs.readFile(__dirname+'/templates/signup.html', function(err, data) {
      if (err) {
        throw err;
      }
      resp.send(data.toString());
    });
  });

  /** include homepage route */
  app.get('/', function(req, resp) {
    fs.readFile(__dirname+'/templates/index.html', function(err, data) {
      if (err) {
        throw err;
      }
      var body=data.toString();
      body=body.replace('{api_client_id}', api_client_id);
      body=body.replace('{uplink_client_id}', upstream_client_id);
      resp.send(body);
    });
  });

}
