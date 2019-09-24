const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
    it('user search', async () => {
      const res = await platformApi.serverRequest('users/search?q=test')
      assert.equal(200, res.statusCode)
      console.log('user search res', res.response.data)
    })
    it('get user files', async () => {
      const res = await platformApi.serverRequest('users/me/files')
      assert.equal(200, res.statusCode)
      // right now just []
      //console.log('user files res', res.response.data)
    })
  },
}
