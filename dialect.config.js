/**
 * Set up defined API routes at prefix
 */
module.exports = function(app, prefix) {
  var dispatcher = app.dispatcher;
  var nconf = app.nconf;

  app.get(prefix + '/sapphire/v1/config', function(req, resp) {
    var res={
      meta: {
        code: 200,
      },
      data: {
        limits: {
          default: {
            max_file_size: nconf.get('limits:default:max_file_size')
          }
        }
      }
    };
    function sendRes() {
      resp.type('application/json');
      resp.setHeader("Access-Control-Allow-Origin", "*");
      resp.status(res.meta.code).type('application/json').json(res);
    }
    if (req.token) {
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        if (usertoken !== null) {
          req.apiParams.tokenobj = usertoken;
        }
        // FIXME: if token, adjust values...
        sendRes()
      });
    } else {
      sendRes()
    }
  });
}
