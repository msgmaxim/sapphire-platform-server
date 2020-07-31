const assert = require('assert')

/*
create channel res {
  counts: { messages: 0, subscribers: 0 },
  has_unread: false,
  id: 4,
  is_inactive: false,
  readers: {
    any_user: false,
    immutable: false,
    public: false,
    user_ids: [],
    you: true
  },
  editors: {
    any_user: false,
    immutable: false,
    public: false,
    user_ids: [],
    you: true
  },
  writers: {
    any_user: false,
    immutable: false,
    public: false,
    user_ids: [],
    you: true
  },
  type: 'moe.sapphire.test',
  you_can_edit: true,
  you_muted: false,
  you_subscribed: true,
  owner: {
    id: 234,
    username: 'test',
    created_at: '2019-09-23T22:36:27.000Z',
    canonical_url: null,
    type: '',
    timezone: 'US/Pacific',
    locale: 'en',
    avatar_image: { url: '', width: 0, height: 0, is_default: true },
    cover_image: { url: '', width: 0, height: 0, is_default: true },
    counts: { following: 93, posts: 185, followers: 1, stars: 0 },
    description: { text: 'Test description', html: '', entities: [Object] },
    name: 'Test User'
  }
}
*/

module.exports = {
  runTests: function(platformApi, testConfig) {
    // just set a default incase adding is disabled
    let channelRes = {
      response: {
        data: {
          id: 1
        }
      }
    }
    let messageRes
    // once this was returning the subscription id instead of the channel id
    it('create channel', async() => {
      channelRes = await platformApi.serverRequest('channels', {
        method: 'POST',
        objBody: {
          type: 'moe.sapphire.unittests'
        }
      })
      //console.log('create channel res', channelRes)
      assert.equal(200, channelRes.statusCode)
      assert.equal(200, channelRes.response.meta.code)
      assert.ok(200, channelRes.response.data.id)
    })
    // should be able to make sure the ID is valid
    it('get channel', async() => {
      if (channelRes.response.data.id === undefined) {
        channelRes = {
          response: {
            data: {
              id: 1
            }
          }
        }
      }
      const getChannelRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id)
      assert.equal(200, getChannelRes.statusCode)
    })
    it('update channel', async() => {
      const getChannelRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id, {
        method: 'PUT'
      })
      assert.equal(200, getChannelRes.statusCode)
    })

    it('get my channels', async() => {
      const multiChannelRes = await platformApi.serverRequest('users/me/channels')
      assert.equal(200, multiChannelRes.statusCode)
    })
    it('search channel type', async() => {
      const searchChannelRes = await platformApi.serverRequest('channels/search', {
        params: {
          type: 'moe.sapphire.test'
        }
      })
      assert.equal(200, searchChannelRes.statusCode)
    })
    it('search channel owner', async() => {
      const searchChannelRes = await platformApi.serverRequest('channels/search', {
        params: {
          creator_id: '@' + testConfig.testUsername
        }
      })
      assert.equal(200, searchChannelRes.statusCode)
    })
    it('get multiple channel', async() => {
      const multiChannelRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id, {
        params: {
          ids: '@' + testConfig.testUsername
        }
      })
      assert.equal(200, multiChannelRes.statusCode)
    })
    // subscriptions
    it('sub to channel', async() => {
      // console.log('subbing using token', platformApi.token)
      const channelSubRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/subscribe', {
        method: 'POST'
      })
      assert.equal(200, channelSubRes.statusCode)
    })
    // /reference/resources/channel/subscriptions/#retrieve-users-subscribed-to-a-channel
    // channels/X/subscribers
    // dispatcher: getChannelSubscriptions
    // dataaccess: getChannelSubscriptionsPaged
    // docs says returns a channel Obj but logic and pnut says it should return users
    // return users
    it('get channel subscribers', async() => {
      const channelSubRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/subscribers')
      assert.equal(200, channelSubRes.statusCode)
      // console.log('channelSubRes data', channelSubRes.response.data)
      // anything but zero
      assert.ok(channelSubRes.response.data.length)
      // make sure it has our user in data
      assert.ok(channelSubRes.response.data.some(u => u.id === testConfig.testUserid))
      assert.ok(channelSubRes.response.data.some(u => u.username === testConfig.testUsername))
    })
    // /reference/resources/channel/subscriptions/#retrieve-user-ids-subscribed-to-a-channel
    // channels/X/subscribers/ids
    // dispatcher: getChannelsSubscriptionIds
    // dataaccess: getChannelSubscriptions
    // returns an array of user IDs
    // (should be string formatted IDs)
    it('get single channel subscribe id', async() => {
      //console.log('asking for', channelRes.response.data.id, 'using token', platformApi.token)
      const channelSingleSubIdRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/subscribers/ids')
      // getting 401 right now... is it wrong? no param swap
      //console.log('channelSingleSubIdRes', channelSingleSubIdRes)
      assert.equal(200, channelSingleSubIdRes.statusCode)
      //console.log('channelSingleSubIdRes data', channelSingleSubIdRes.response.data)
      // we have at least one
      assert.ok(channelSingleSubIdRes.response.data.length)
      // make sure it contains our user
      assert.ok(channelSingleSubIdRes.response.data.indexOf(testConfig.testUserid) !== -1)
    })
    // /reference/resources/channel/subscriptions/#retrieve-user-ids-subscribed-to-a-channel
    // channels/subscribers/ids
    // dispatcher: getChannelsSubscriptionIds
    // dataaccess: getChannelSubscriptions
    // returns an Object keyed by channel IDs with values being an array of user IDs
    // (all user/channel IDs should be string formatted)
    it('get multi channel subscribe id', async() => {
      const channelMultipleSubIdRes = await platformApi.serverRequest('channels/subscribers/ids', {
        params: {
          ids: channelRes.response.data.id
        }
      })
      // console.log('channelMultipleSubIdRes', channelMultipleSubIdRes)
      assert.equal(200, channelMultipleSubIdRes.statusCode)
      // get user list for this channel
      //console.log('channelMultipleSubIdRes data', channelMultipleSubIdRes.response.data)
      assert.ok(channelMultipleSubIdRes.response.data[channelRes.response.data.id])
      assert.ok(channelMultipleSubIdRes.response.data[channelRes.response.data.id].indexOf(testConfig.testUserid) !== -1)
    })
    // /reference/resources/channel/subscriptions/#unsubscribe-from-a-channel
    // channels/X/subscribe
    // dispatcher: delChannelSubscription
    // dataaccess: setSubscription
    // returns channel object
    it('unsub to channel', async() => {
      const channelSubRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/subscribe', {
        method: 'DELETE'
      })
      assert.equal(200, channelSubRes.statusCode)
    })
    // FIXME: check subscriptions again to make sure it's zero...
    /*
  data: {
    channel_id: '17',
    created_at: '2019-09-29T03:02:52.413Z',
    entities: { mentions: [], hashtags: [], links: [] },
    id: 617,
    machine_only: false,
    num_replies: 0,
    source: {},
    thread_id: 617,
    text: 'test text',
    html: '<span itemscope="https://app.net/schemas/Post">test text</span>',
    user: {
      id: 234,
      username: 'test',
      created_at: '2019-09-23T22:36:27.000Z',
      canonical_url: null,
      type: '',
      timezone: 'US/Pacific',
      locale: 'en',
      avatar_image: [Object],
      cover_image: [Object],
      counts: [Object],
      description: [Object],
      name: 'Test User'
    }
  }
*/
    it('create message', async() => {
      messageRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/messages', {
        method: 'POST',
        objBody: {
          text: 'test text',
          machine_only: true
        }
      })
      assert.equal(200, messageRes.statusCode)
      //console.log('create message res', messageRes.response)
    })
    it('get message', async() => {
      const getMessageRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/messages/' + messageRes.response.data.id)
      assert.equal(200, getMessageRes.statusCode)
    })
    it('get channel messages', async() => {
      messagesRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/messages')
      assert.equal(200, messagesRes.statusCode)
    })

    it('delete message', async() => {
      const delMessageRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id + '/messages/' + messageRes.response.data.id)
      assert.equal(200, delMessageRes.statusCode)
    })

    it('delete channel', async() => {
      const delChannelRes = await platformApi.serverRequest('channels/' + channelRes.response.data.id, {
        method: 'DELETE'
      })
      assert.equal(200, delChannelRes.statusCode)
      assert.equal(true, delChannelRes.response.data.is_inactive)
      assert.equal(undefined, delChannelRes.response.data.is_deleted)
      assert.equal(undefined, delChannelRes.response.data.is_delete)
      //console.log('delete channel res', delChannelRes.response.data)
    })
  }
}
