module.exports = {
  //
  // channel_subscription
  //
  /**
   * add/update channel subscription
   * @param {object} data - subscription data
   * @param {boolean} deleted - subscribe/unscribe
   * @param {number} ts - the timestamp of the event
   * @param {metaCallback} callback - function to call after completion
   */
  setChannelSubscription: function(data, deleted, ts, callback) {
    //console.log('subscriptions.controller::setChannelSubscription - data', data, 'del', del)
    // update user object
    if (data.user) {
      this.updateUser(data.user, ts)
    }
    // update channel object
    this.setChannel(data.channel, ts)
    // update subscription
    this.cache.setSubscription(data.channel.id, data.user.id, deleted, ts, callback)
    if (this.notsilent) {
      process.stdout.write(deleted ? 's' : 'S')
    }
  },
  addChannelSubscription: function(tokenobj, channel_id, params, callback) {
    //console.log('subscriptions.controller::addChannelSubscription - channel', channel_id)

    //If a user has muted this Channel, this call will automatically unmute the Channel
    const ref = this
    //addSubscription: function (channel_id, userid, callback) {
    this.cache.addSubscription(channel_id, tokenobj.userid, function(err, subscription) {
      if (err) console.error('subscriptions.controller.js::addChannelSubscription - err', err)
      params.subscribedOpt = true
      ref.getChannel(channel_id, params, callback)
    })
  },
  delChannelSubscription: function(tokenobj, channel_id, params, callback) {
    //console.log('subscriptions.controller::delChannelSubscription - channel', channel_id)
    const ref = this
    //channel_id, userid, del, ts, callback
    this.cache.setSubscription(channel_id, tokenobj.userid, true, new Date(), function(err, subscription) {
      if (err) console.error('subscriptions.controller.js::setSubscription - err', err)
      //delSubscription: function (channel_id, userid, callback) {
      //this.cache.delSubscription(channel_id, tokenobj.userid, function(subscription, err) {
      params.unsubscribedOpt = true
      ref.getChannel(channel_id, params, callback)
    })
  },
  /**
   * get subscriptions for specified user id
   * @param {number} userid - the id of user you're requesting
   * @param {object} param - channel formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getUserSubscriptions: function(userid, params, callback) {
    //console.log('subscriptions.controller.js::getUserSubscriptions -', userid)
    // include_recent messages
    // channel_types filter
    const ref = this

    /*
    //console.log('subscriptions.controller.js::getUserSubscriptions - params', params)
    var nParams = params.pageParams
    //console.log('subscriptions.controller.js::getUserSubscriptions - nParams', nParams)
    if (nParams.count===undefined) nParams.count=20
    if (nParams.before_id===undefined) nParams.before_id=-1 // -1 being the very end
    var oldcount=nParams.count
    // but we want to make sure it's in the right direction
    // if count is positive, then the direction is older than the 20 oldest post after before_id
    if (nParams.count>0) {
      nParams.count+=1 // add one at the end to check if there's more
    }
    if (nParams.count<0) {
      nParams.count-=1 // add one at the end to check if there's more
    }
    if (params.channelParams.types) {
      nParams.types=params.channelParams.types
    }
    */

    this.cache.getUserSubscriptions(userid, params, function(subsErr, subs, subsMeta) {
      //console.log('subscriptions.controller.js::getUserSubscriptions - ', userid, 'has', subs.length)
      if (subsErr) console.error('subscriptions.controller.js::getUserSubscriptions - err', subsErr)
      if (!subs.length) {
        callback(subsErr, [], { code: 200, more: false })
        return
      }
      const channelids = []
      for (const i in subs) {
        const sub = subs[i]
        channelids.push(sub.channelid)
      }
      if (!channelids.length) {
        callback(subsErr, [], { code: 200, more: false })
        return
      }
      //getChannel: function(ids, params, callback) {
      params.tokenobj.subscribedOpt = true
      const result_recent_messages = params.generalParams.recent_messages
      params.generalParams.recent_messages = true
      //params.channelParams.types=
      ref.getChannel(channelids, params, function(apiErr, apis, apiMeta) {
        if (apiErr) console.error('subscriptions.controller.js::getUserSubscriptions - getChannel err', apiErr)
        //console.log('subscriptions.controller.js::getUserSubscriptions - got apis', apis.length)
        // sort by the "most recent post first"
        let list = []
        for (const i in apis) {
          const api = apis[i]
          let ts = 0
          if (api.recent_message) {
            ts = new Date(api.recent_message.created_at).getTime()
          }
          //console.log('subscriptions.controller.js::getUserSubscriptions - presort list', api.id)
          list.push([i, ts])
        }
        //console.log('subscriptions.controller.js::getUserSubscriptions - presort list', list)
        // sort list (ts desc (highest first))
        list = list.sort(function(a, b) {
          if (a[1] < b[1]) return 1
          if (a[1] > b[1]) return -1
          return 0
        })
        //console.log('subscriptions.controller.js::getUserSubscriptions - postsort list', list)
        const nlist = []
        for (const i in list) {
          // strip out the recent_messages?
          if (result_recent_messages) {
            //
          }
          const api = apis[list[i][0]]
          //console.log('subscriptions.controller.js::getUserSubscriptions - post list', api.id)
          nlist.push(api)
        }
        //console.log('subscriptions.controller.js::getUserSubscriptions - final count', nlist.length)
        // we actually want the count from subsMeta
        callback(apiErr, nlist, subsMeta)
      })
      /*
      var channelCriteria={ where: { id: { in: channelids } } }
      if (params.types) {
        channelCriteria.where['type']={ in: params.types.split(/,/) }
        //console.log('dataaccess.caminte.js::getUserSubscriptions - types', channelCriteria.where['type'])
      }
      channelModel.find(channelCriteria, function (err, channels) {
        callback(channels, err, meta)
      })
      */

      /*
      var apis={}
      var count=0
      var min_id = 999999
      var max_id = 0
      for(var i in channels) {
        var channel_id=channels[i].id
        console.log('subscriptions.controller.js::getUserSubscriptions - in order', channel_id)
        min_id=Math.min(channel_id, min_id)
        max_id=Math.max(channel_id, max_id)
        params.tokenobj.subscribedOpt=true
        // channel, params, tokenObj, callback, meta
        ref.channelToAPI(channels[i], params, params.tokenobj, function(channel, cErr) {
          //apis.push(channel)
          apis[channel.id]=channel
          count++
          if (count == channels.length) {
            var nlist=[]
            for(var i in channels) {
              //console.log('subscriptions.controller.js::getUserSubscriptions - out order', channels[i].id)
              nlist.push(apis[channels[i].id])
            }
            callback(nlist, err || cErr, { code: 200, min_id: min_id,
              max_id: max_id, more: false})
          }
        })
      }
      */
    })
  },
  /**
   * get subscriptions for specified channel id
   * @param {number} channelid - the id of channel you're requesting
   * @param {object} param - user formatting options
   * @param {metaCallback} callback - function to call after completion
   */
  getChannelSubscriptions: function(channelid, params, callback) {
    const ref = this
    //console.log('subscriptions.controller.js::getChannelSubscriptions - start', channelid)
    this.cache.getChannelSubscriptionsPaged([channelid], params, function(err, subs, meta) {
      if (err) console.error('subscriptions.controller.js::getChannelSubscriptions - err', err)
      //console.log('subscriptions.controller.js::getChannelSubscriptions - ', channelid, 'has', subs.length, 'subs');
      if (!subs.length) {
        return callback(null, [], meta)
      }
      const userIDs = subs.map(sub => sub.userid)
      //console.log('subscriptions.controller.js::getChannelSubscriptions - userIDs', userIDs);
      ref.getUsers(userIDs, params, function(uErr, users, uMeta) {
        if (uErr) console.error('subscriptions.controller.js::getChannelSubscriptions - getUsers err', uErr)
        callback(uErr, users, uMeta)
      })
      /*
      var list = []
      for(var i in subs) {
        var sub = subs[i].userid
        // FIXME: remove N+1
        //console.log('subscriptions.controller.js::getChannelSubscriptions - user', sub)
        ref.getUser(sub, params, function(user, uErr, uMeta) {
          list.push(user)
          //console.log('subscriptions.controller.js::getChannelSubscriptions -', list.length, subs.length)
          if (list.length == subs.length) {
            callback(list, '', meta)
          }
        })
      }
      */
    })
  },
  getChannelsSubscriptionIds: function(ids, params, token, callback) {
    //console.log('subscriptions.controller.js::getChannelsSubscriptionIds - start', ids)
    this.cache.getChannelSubscriptions(ids, params, function(err, subs, meta) {
      //console.log('subscriptions.controller.js::getChannelsSubscriptionIds - ', ids, 'has', subs.length, 'subs');
      if (err) console.error('subscriptions.controller.js::getChannelsSubscriptionIds - err', err)
      if (!subs.length) {
        return callback(null, [], meta)
      }
      const result = {}
      for (const i in subs) {
        const chanId = parseInt(subs[i].channelid)
        // console.log('channel', chanId, 'has', subs[i].userid)
        if (result[chanId] === undefined) {
          result[chanId] = [subs[i].userid]
        } else { result[chanId].push(subs[i].userid) }
      }
      callback(null, result, meta)
    })
  }
}
