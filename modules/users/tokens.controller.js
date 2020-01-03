module.exports = {
  //
  // user token
  //
  // so we need access to the session store
  // or some way to get context
  getAppCallbacks: function(client_id, client_secret, callback) {
    this.cache.getAppCallbacks(client_id, client_secret, callback)
  },
  /**
   * get current context user token
   * @param {metaCallback} callback - function to call after completion
   */
  getToken: function(userid, client_id, params, callback) {
    // we could lookup unique token by userid/client_id
    // dummy token
    this.getUser(userid, params, function(err, user) {
      var token={
        app: {
          client_id: client_id,
          link: "http://foo.example.com",
          name: "Test app",
        },
        scopes: [
          "stream",
          "messages",
          "export",
          "write_post",
          "follow"
        ],
        limits: {
          "following": 40,
          "max_file_size": 10000000
        },
        "storage": {
          "available": 8787479688,
          "used": 1212520312
        },
        user: user,
        "invite_link": "https://join.app.net/from/notareallink"
      }
      //console.log('dispatcher::getToken - ', token)
      callback(false, token)
    })
  },
  getUserClientByToken: function(token, callback) {
    //console.log('dispatcher::getUserClientByToken', token)
    this.cache.getAPIUserToken(token, callback)
  },
  /**
   * add/update user token
   * @param {number} userid - owner of token
   * @param {string} client_id - client token is for
   * @param {array} scopes - token scope
   * @param {string} token - upstream token
   */
  // FIXME: store downstream token, so we can look it up later!
  setToken: function(userid, client_id, scopes, token, callback) {
    // function(userid, client_id, scopes, token, callback)
    this.cache.addAPIUserToken(userid, client_id, scopes, token, callback)
  },
  createOrFindToken: function(userid, client_id, scopes, token, callback) {
    // function(userid, client_id, scopes, token, callback)
    this.cache.createOrFindUserToken(userid, client_id, scopes, token, callback)
  },
  setUpstreamToken: function(userid, token, scopes, callback) {
    this.cache.setUpstreamUserToken(userid, token, scopes, callback)
  },
}
