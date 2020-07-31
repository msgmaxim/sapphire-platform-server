/**
 * Set up defined API routes at prefix
 */
const configUtil = require('./lib/lib.config.js')

module.exports = function(app, prefix) {
  var dispatcher = app.dispatcher
  var nconf = app.nconf

  app.get(prefix + '/sapphire/v1/config', function(req, resp) {
    var res = {
      meta: {
        code: 200
      },
      data: {
        limits: {
          default: {
            max_file_size: nconf.get('limits:default:max_file_size')
          }
        },
        modules: {
          channels: configUtil.moduleEnabled('channels'),
          clients: configUtil.moduleEnabled('client'),
          files: configUtil.moduleEnabled('files'),
          follows: configUtil.moduleEnabled('follow'),
          markers: configUtil.moduleEnabled('markers'),
          posts: configUtil.moduleEnabled('posts'),
          streams: configUtil.moduleEnabled('stream'),
          users: configUtil.moduleEnabled('users')
        }
      }
    }
    function sendRes() {
      resp.type('application/json')
      resp.setHeader('Access-Control-Allow-Origin', '*')
      resp.status(res.meta.code).type('application/json').json(res)
    }
    if (req.token) {
      dispatcher.getUserClientByToken(req.token, function(usertoken, err) {
        if (usertoken !== null) {
          req.apiParams.tokenobj = usertoken
        }
        // FIXME: if token, adjust values...
        sendRes()
      })
    } else {
      sendRes()
    }
  })
}
