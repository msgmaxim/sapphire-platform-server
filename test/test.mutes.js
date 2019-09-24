const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
    it('get user mutes', async () => {
      const res = await platformApi.serverRequest('users/@test/muted')
      assert.equal(200, res.statusCode)
      // { meta: { code: 200 }, data: [] }
      //console.log('user mutes', res.response.data)
    })
    it('mute self', async () => {
      const res = await platformApi.serverRequest('users/@test/mute', {
        method: 'POST'
      })
      assert.equal(200, res.statusCode)
      assert.equal('test', res.response.data.username)
/*
 {
  id: 234,
  username: 'test',
  created_at: '2019-09-23T22:36:27.000Z',
  canonical_url: null,
  type: null,
  timezone: null,
  locale: null,
  avatar_image: { url: null, width: null, height: null, is_default: false },
  cover_image: { url: null, width: null, height: null, is_default: false },
  counts: { following: 0, posts: 0, followers: 0, stars: 0 }
}
*/
      //console.log('user muted', res.response.data)
    })
    it('unmute self', async () => {
      const res = await platformApi.serverRequest('users/@test/mute', {
        method: 'DELETE'
      })
      assert.equal(200, res.statusCode)
      // []
      //console.log('user muted', res.response.data)
    })
  },
}
