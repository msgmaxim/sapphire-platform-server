const assert = require('assert')

module.exports = {
  runTests: function(platformApi) {
/*
{
  id: '1',
  text: 'test post',
  html: '<span itemscope="https://app.net/schemas/Post">te&#115;t po&#115;t</span>',
  canonical_url: null,
  created_at: '2019-09-29T00:47:36Z',
  machine_only: false,
  num_replies: 0,
  num_reposts: 0,
  num_stars: 0,
  thread_id: '1',
  entities: { mentions: [], hashtags: [], links: [] },
  is_deleted: false,
  source: {
    link: 'nowhere',
    name: 'Unknown',
    client_id: 'mocha_platform_test'
  },
  user: {
    id: '234',
    username: 'test',
    created_at: '2019-09-23T22:36:27Z',
    canonical_url: null,
    type: null,
    timezone: null,
    locale: null,
    avatar_image: { url: null, width: null, height: null, is_default: false },
    cover_image: { url: null, width: null, height: null, is_default: false },
    counts: { following: 6, posts: 0, followers: 0, stars: 0 },
    follows_you: false,
    you_blocked: false,
    you_follow: false,
    you_muted: false,
    you_can_subscribe: false,
    you_can_follow: true
  },
  annotations: [],
  you_starred: false,
  you_reposted: false
}
*/
    let res
    let replyRes
    it('create post', async () => {
      res = await platformApi.serverRequest('posts', {
        method: 'POST',
        objBody: {
          text: '.@test post #hashtag',
          machine_only: true
        }
      })
      assert.equal(200, res.statusCode)
      //console.log('create post res', res.response.data)
    })
    it('get post', async () => {
      //console.log('get post', res.response.data.id)
      const postRes = await platformApi.serverRequest('posts/' + res.response.data.id)
      assert.equal(200, postRes.statusCode)
      assert.equal(res.response.data.id, postRes.response.data.id)
    })

    it('get hashtag posts', async () => {
      const postRes = await platformApi.serverRequest('posts/tag/hashtag')
      assert.equal(200, postRes.statusCode)
    })

    it('get user posts', async () => {
      //console.log('get post', res.response.data.id)
      const postRes = await platformApi.serverRequest('users/@test/posts')
      assert.equal(200, postRes.statusCode)
      //assert.equal(res.response.data[0].user.id, postRes.response.data[0].user.id)
      // should always be an array
      //console.log('get user posts', postRes.response.data)
    })

    it('get global posts', async () => {
      const postRes = await platformApi.serverRequest('posts/stream/global')
      assert.equal(200, postRes.statusCode)
      // should always be an array
      //console.log('get global posts', postRes.response.data)
    })

    it('get explore feeds', async () => {
      const postRes = await platformApi.serverRequest('posts/stream/explore')
      assert.equal(200, postRes.statusCode)
      // should always be an array
      //console.log('get global posts', postRes.response.data)
    })

    it('get an explore feed', async () => {
      const postRes = await platformApi.serverRequest('posts/stream/explore/feed')
      assert.equal(200, postRes.statusCode)
      // should always be an array
      //console.log('get global posts', postRes.response.data)
    })


    it('star post', async () => {
      //console.log('star post for', res.response.data.id)
      const starRes = await platformApi.serverRequest('posts/' + res.response.data.id + '/star', {
        method: 'POST'
      })
      assert.equal(200, starRes.statusCode)
    })
    it('get user stars', async () => {
      //console.log('get post', res.response.data.id)
      const postRes = await platformApi.serverRequest('users/@test/stars')
      assert.equal(200, postRes.statusCode)
      //assert.equal(res.response.data[0].user.id, postRes.response.data[0].user.id)
      // should always be an array
      //console.log('get user stars', postRes.response.data)
    })

    it('unstar post', async () => {
      //console.log('unstar post for', res.response.data.id)
      const starRes = await platformApi.serverRequest('posts/' + res.response.data.id + '/star', {
        method: 'DELETE'
      })
      assert.equal(200, starRes.statusCode)
    })
    it('repost post', async () => {
      //console.log('repost ', res.response.data.id)
      const starRes = await platformApi.serverRequest('posts/' + res.response.data.id + '/repost', {
        method: 'POST'
      })
      assert.equal(200, starRes.statusCode)
    })
    it('unrepost post', async () => {
      //console.log('unrepost', res.response.data.id)
      const starRes = await platformApi.serverRequest('posts/' + res.response.data.id + '/repost', {
        method: 'DELETE'
      })
      assert.equal(200, starRes.statusCode)
    })

    it('post search', async () => {
      const postRes = await platformApi.serverRequest('posts/search?q=test')
      assert.equal(200, postRes.statusCode)
      // [] we're not found??
      //console.log('post search res', postRes.response.data)
    })
    it('get user mentions', async () => {
      const userMentionRes = await platformApi.serverRequest('users/@test/mentions')
      assert.equal(200, userMentionRes.statusCode)
      // right now just an array of a ton of posts...
      //console.log('get user mentions res', userMentionRes.response.data.length)
    })


    it('creating a reply', async () => {
      //console.log('getting replies for', res.response.data.id)
      replyRes = await platformApi.serverRequest('posts', {
        method: 'POST',
        objBody: {
          text: 'test reply',
          reply_to: res.response.data.id,
          machine_only: true
        }
      })
      assert.equal(200, replyRes.statusCode)
    })
    it('getting replies', async () => {
      //console.log('getting replies for', res.response.data.id)
      const res3 = await platformApi.serverRequest('posts/' + res.response.data.id + '/replies')
      assert.equal(200, res3.statusCode)
      assert.equal(2, res3.response.data.length)
      // is a list of posts
      // should include original?
      //console.log('replies res', res3.response.data)
    })
    it('delete reply', async () => {
      //console.log('deleting reply for', replyRes.response.data.id)
      const delRes = await platformApi.serverRequest('posts/' + replyRes.response.data.id, {
        method: 'DELETE',
      })
      assert.equal(200, delRes.statusCode)
      assert.equal(true, delRes.response.data.is_deleted)
      //console.log('delete reply res', delRes.response.data)
    })
    it('delete op', async () => {
      //console.log('deleting post for', res.response.data.id)
      const delRes = await platformApi.serverRequest('posts/' + res.response.data.id, {
        method: 'DELETE',
      })
      assert.equal(200, delRes.statusCode)
      assert.equal(true, delRes.response.data.is_deleted)
      //console.log('delete op res', delRes.response.data)
    })
  },
}
