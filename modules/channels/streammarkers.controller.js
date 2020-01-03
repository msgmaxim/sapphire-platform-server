module.exports={
  //
  // stream_marker
  //
  /**
   * get stream marker
   * @todo spec out proper prototype
   * @todo implement function
   * @param {object} data - stream marker data object
   */
  getStreamMarker: function(name, usertoken, params, callback) {
    this.cache.getStreamMarker(usertoken.userid, name, callback)
  },
  /**
   * add/update stream marker
   * @todo spec out proper prototype
   * @todo implement function
   * @param {object} data - stream marker data object
   */
  setStreamMarker: function(name, id, percentage, usertoken, params, callback) {
    this.cache.setStreamMarker(usertoken.userid, name, id, percentage, params, callback)
  },
}
