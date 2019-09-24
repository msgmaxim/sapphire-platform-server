const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
    it('get user interactions', async () => {
      const res = await platformApi.serverRequest('users/@test/interactions')
      assert.equal(200, res.statusCode)
      // right now just []
      //console.log('res', res.response.data)
    })
  },
}
