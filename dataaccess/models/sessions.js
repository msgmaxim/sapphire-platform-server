var sessionModel

function start(options) {
  const schemaData = options.schemaData
  // shouldn't this live in schemaToken ?
  sessionModel = schemaData.define('sessions', {
    code: { type: String, index: true },
    client_id: { type: String, }, // leave it as a string so login is optimized
    redirect_uri: { type: String, },
    response_type: { type: String, },
    requested_scopes: { type: String, },
    userid: { type: Number, index: true },
    username: { type: String, },
    state: { type: String, },
    upstream_token: { type: String, },
    local_token: { type: String, },
  })
}

module.exports = {
  next: null,
  start: start,
  /*
   * session
   */
  createSession: function(client_id, redirect_uri, response_type, requested_scopes, state, callback) {
    console.log('state', state, 'requested_scopes', requested_scopes)
    var code = 'altapicode_' + generateToken(98)
    sessionModel.create({
      code: code,
      client_id: client_id,
      redirect_uri: redirect_uri,
      response_type: response_type,
      requested_scopes: requested_scopes?requested_scopes:'',
      state: state?state:'',
      userid: 0,
      username: '',
    }, function(err, obj) {
      if (err) {
        console.log('createSession - err', err)
      }
      //console.log('createSession - obj', obj)
      callback(obj)
    })
  },
  authSession: function(code, userid, username, upstream_token, localToken, callback) {
    sessionModel.find({ where: { code: code } }, function(err, sessions) {
      if (err) {
        console.log('authSession - err', err)
      }
      if (sessions) {
        if (sessions.length == 1) {
          var ses = sessions[0]
          ses.userid = userid
          ses.username = username
          ses.upstream_token = upstream_token
          ses.local_token = localToken
          ses.save(function(uErr) {
            if (uErr) {
              console.log('authSession - uErr', uErr)
            }
            callback(ses, uErr)
          })
        } else {
          console.log('authSession - too many sessions for that code')
          callback({}, 'too many sessions for that code')
          return
        }
      } else {
        console.log('authSession - no sessions for that code')
        callback({}, 'no sessions for that code')
        return
      }
    })
  },
  getSessionByCode: function(code, callback) {
    sessionModel.find({ where: { code: code} }, function(err, sessions) {
      if (err) {
        console.log('authSession - err', err)
      }
      if (sessions) {
        if (sessions.length == 1) {
          callback(sessions[0], err)
        } else {
          console.log('authSession - too many sessions for that code')
          callback({}, 'too many sessions for that code')
          return
        }
      } else {
        console.log('authSession - no sessions for that code')
        callback({}, 'no sessions for that code')
        return
      }
    })
  },
}
