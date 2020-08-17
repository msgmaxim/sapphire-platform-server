let sessionModel

const generateToken = function(string_length) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
  let randomstring = ''
  for (let x = 0; x < string_length; x++) {
    const letterOrNumber = Math.floor(Math.random() * 2)
    if (letterOrNumber === 0) {
      const newNum = Math.floor(Math.random() * 9)
      randomstring += newNum
    } else {
      const rnum = Math.floor(Math.random() * chars.length)
      randomstring += chars.substring(rnum, rnum + 1)
    }
  }
  return randomstring
}

function start(options) {
  const schemaData = options.schemaData
  // shouldn't this live in schemaToken ?
  sessionModel = schemaData.define('sessions', {
    code: { type: String, index: true },
    client_id: { type: String }, // leave it as a string so login is optimized
    redirect_uri: { type: String },
    response_type: { type: String },
    requested_scopes: { type: String },
    userid: { type: Number, index: true },
    username: { type: String },
    state: { type: String },
    upstream_token: { type: String },
    local_token: { type: String }
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
    const code = 'altapicode_' + generateToken(98)
    sessionModel.create({
      code: code,
      client_id: client_id,
      redirect_uri: redirect_uri,
      response_type: response_type,
      requested_scopes: requested_scopes || '',
      state: state || '',
      userid: 0,
      username: ''
    }, function(err, obj) {
      if (err) {
        console.log('createSession - err', err)
      }
      //console.log('createSession - obj', obj)
      callback(err, obj)
    })
  },
  authSession: function(code, userid, username, upstream_token, localToken, callback) {
    sessionModel.find({ where: { code: code } }, function(err, sessions) {
      if (err) {
        console.log('authSession - err', err)
      }
      if (sessions) {
        if (sessions.length === 1) {
          const ses = sessions[0]
          ses.userid = userid
          ses.username = username
          ses.upstream_token = upstream_token
          ses.local_token = localToken
          ses.save(function(uErr) {
            if (uErr) {
              console.log('authSession - uErr', uErr)
            }
            callback(uErr, ses)
          })
        } else {
          console.log('authSession - too many sessions for that code')
          callback(new Error('too many sessions for that code'), {})
        }
      } else {
        console.log('authSession - no sessions for that code')
        callback(new Error('no sessions for that code'), {})
      }
    })
  },
  getSessionByCode: function(code, callback) {
    sessionModel.find({ where: { code: code } }, function(err, sessions) {
      if (err) {
        console.log('authSession - err', err)
      }
      if (sessions) {
        if (sessions.length === 1) {
          callback(err, sessions[0])
        } else {
          console.log('authSession - too many sessions for that code')
          callback(new Error('too many sessions for that code'), {})
        }
      } else {
        console.log('authSession - no sessions for that code')
        callback(new Error('no sessions for that code'), {})
      }
    })
  }
}
