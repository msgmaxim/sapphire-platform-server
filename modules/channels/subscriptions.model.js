let SubscriptionModel
let applyParams

function start(options) {
  const schemaData = options.schemaData
  applyParams = options.applyParams
  /** subscription storage model */
  SubscriptionModel = schemaData.define('subscriptions', {
    channelid: { type: Number, index: true },
    userid: { type: Number, index: true },
    created_at: { type: Date },
    active: { type: Boolean, index: true },
    last_updated: { type: Date }
  })
}

module.exports = {
  next: null,
  start: start,
  /** subscription */
  /*
    channelid: { type: Number, index: true },
    userid: { type: Number, index: true },
    created_at: { type: Date, index: true },
    active: { type: Boolean, index: true },
    last_updated: { type: Date },
  */
  addSubscription: function(channel_id, userid, callback) {
    //console.log('subscriptions.model::addSubscription - channel_id', channel_id, 'userid', userid);
    SubscriptionModel.findOne({
      where: {
        channelid: parseInt(channel_id),
        userid: parseInt(userid)
      }
    }, function(err, subscription) {
      if (err) {
        console.log('subscriptions.model::addSubscription - err', err)
      }
      //console.log('subscriptions.model::addSubscription - subscription', subscription);
      // if you have a null created_at, we'll just keep making new records with this
      // || !subscription.created_at
      if (!subscription) {
        subscription = new SubscriptionModel()
        subscription.created_at = new Date()
        subscription.channelid  = parseInt(channel_id)
        subscription.userid     = parseInt(userid)
      }
      if (subscription.created_at === null) {
        subscription.created_at = new Date()
      }
      subscription.active = 1
      subscription.last_updated = new Date()
      subscription.save(function() {
        if (callback) {
          //console.log('subscriptions.model::addSubscription result', subscription);
          callback(err, subscription)
        }
      })
    })
  },
  setSubscription: function(channel_id, userid, del, ts, callback) {
    //console.log('subscriptions.model::setSubscription - channel_id', channel_id, 'userid', userid);
    SubscriptionModel.updateOrCreate({
      channelid: parseInt(channel_id),
      userid: parseInt(userid)
    }, {
      active: del ? 0 : 1,
      last_updated: ts
    }, function(err, subscription) {
      //console.log('subscriptions.model::setSubscription result', subscription);
      if (err) {
        console.error('subscriptions.model::setSubscription err', err)
      }
      if (callback) {
        callback(err, subscription)
      }
    })
  },
  getSubscription: function(channel_id, user_id, callback) {
    user_id = parseInt(user_id) // ensure it's a number at this point
    if (isNaN(user_id)) {
      console.log('dataaccess.caminte.js::getSubscription - userid is NaN')
      callback(new Error('userid is NaN'), [])
      return
    }
    SubscriptionModel.findOne({ where: { active: 1, userid: user_id, channelid: channel_id } }, callback)
  },
  /*
  delSubscription: function (channel_id, userid, callback) {
    SubscriptionModel.remove({
      channelid: channel_id,
      userid: userid,
    }, function(err, subscription) {
      if (callback) {
        callback(subscription, err);
      }
    });
  },
  */
  getUserSubscriptions: function(userid, params, callback) {
    //console.log('dataaccess.caminte.js::getUserSubscriptions - userid is', userid);
    if (userid === undefined) {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is undefined')
      callback(new Error('userid is undefined'), [])
      return
    }
    if (userid === '') {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is empty')
      callback(new Error('userid is empty'), [])
      return
    }
    userid = parseInt(userid) // ensure it's a number at this point
    if (isNaN(userid)) {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is NaN')
      callback(new Error('userid is NaN'), [])
      return
    }
    const query = SubscriptionModel.find().where('userid', userid).where('active', 1)
    applyParams(query, params, callback)
  },
  getChannelSubscriptionCount: function(channelids, callback) {
    if (channelids === undefined) {
      console.log('dataaccess.caminte.js::getChannelSubscriptionCount - channel id is undefined')
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptionCount - channel id is undefined')
      return
    }
    // FIXME: how slow is this on innodb...
    SubscriptionModel.count({ where: { channelid: { in: channelids }, active: 1 } }, callback)
  },
  // get all subscription records
  getChannelSubscriptions: function(channelids, params, callback) {
    if (channelids === undefined) {
      console.log('dataaccess.caminte.js::getChannelSubscriptions - channel id is undefined')
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptions - channel id is undefined')
      return
    }

    // make memory driver happy
    for (const i in channelids) {
      channelids[i] = parseInt(channelids[i])
    }

    //console.log('dataaccess.caminte.js::getChannelSubscriptions - channelids', channelids);
    /*
    var query=SubscriptionModel.find().where('channelid', { in: channelids }).where('active', 1);
    //console.log('dataaccess.caminte.js::getChannelSubscriptions - query', query);
    applyParams(query, params, callback);
    */
    SubscriptionModel.find({ where: { channelid: { in: channelids }, active: 1 } }, callback)
    /*
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
      return;
    }
    callback(null, null);
    */
  },
  // paged version for public usage
  getChannelSubscriptionsPaged: function(channelids, params, callback) {
    if (channelids === undefined) {
      console.log('dataaccess.caminte.js::getChannelSubscriptionsPaged - channel id is undefined')
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptionsPaged - channel id is undefined')
      return
    }

    // make memory driver happy
    for (const i in channelids) {
      channelids[i] = parseInt(channelids[i])
    }

    //console.log('dataaccess.caminte.js::getChannelSubscriptions - channelids', channelids);
    const query = SubscriptionModel.find().where('channelid', { in: channelids }).where('active', 1)
    //console.log('dataaccess.caminte.js::getChannelSubscriptions - query', query);
    applyParams(query, params, callback)
    /*
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
      return;
    }
    callback(null, null);
    */
  }
}
