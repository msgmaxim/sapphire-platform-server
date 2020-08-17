const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
    it('write post marker', async() => {
      const res = await platformApi.serverRequest('posts/marker', {
        method: 'POST',
        objBody: {
          name: 'marker',
          id: 1,
          percentage: 1.0
        }
      })
      assert.equal(200, res.statusCode)
      /*
res {
  user_id: 234,
  top_id: 1,
  last_read_id: 1,
  name: 'marker',
  percentage: 1,
  last_updated: '2019-09-24T02:44:08.162Z',
  version: 1,
  id: 1
}
*/
    })
  }
}
