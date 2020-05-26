var subscriptionModel
let applyParams

function start(options) {
  const schemaData = options.schemaData
  applyParams = options.applyParams
  /** subscription storage model */
  subscriptionModel = schemaData.define('subscriptions', {
    channelid: { type: Number, index: true },
    userid: { type: Number, index: true },
    created_at: { type: Date },
    active: { type: Boolean, index: true },
    last_updated: { type: Date },
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
  addSubscription: function (channel_id, userid, callback) {
    //console.log('dataaccess.camintejs::addSubscription - channel_id', channel_id, 'userid', userid);
    subscriptionModel.findOne({ where : {
      channelid: channel_id,
      userid: userid,
    } }, function(err, subscription) {
      if (err) {
        console.log('dataaccess.camintejs::addSubscription - err', err);
      }
      //console.log('dataaccess.camintejs::addSubscription - subscription', subscription);
      // if you have a null created_at, we'll just keep making new records with this
      // || !subscription.created_at
      if (!subscription) {
        subscription = new subscriptionModel
        subscription.created_at=new Date();
        subscription.channelid=channel_id;
        subscription.userid=userid;
      }
      if (subscription.created_at == null) {
        subscription.created_at=new Date();
      }
      subscription.active=true;
      subscription.last_updated=new Date();
      subscription.save(function() {
        if (callback) {
          //console.log('dataaccess.camintejs::addSubscription result', subscription);
          callback(err, subscription);
        }
      });
    });
  },
  setSubscription: function (channel_id, userid, del, ts, callback) {
    //console.log('dataaccess.camintejs::setSubscription - channel_id', channel_id, 'userid', userid);
    subscriptionModel.updateOrCreate({
      channelid: channel_id,
      userid: userid
    }, {
      active: !del?true:false,
      last_updated: ts
    }, function(err, subscription) {
      //console.log('dataaccess.camintejs::setSubscription result', subscription);
      if (err) {
        console.error('dataaccess.camintejs::setSubscription err', err)
      }
      if (callback) {
        callback(subscription, err);
      }
    });
  },
  getSubscription: function(channel_id, user_id, callback) {
    user_id=parseInt(user_id); // ensure it's a number at this point
    if (isNaN(user_id)) {
      console.log('dataaccess.caminte.js::getSubscription - userid is NaN');
      callback([], 'userid is NaN');
      return;
    }
    subscriptionModel.findOne({ where: { active: 1, userid: user_id, channelid: channel_id } }, function(err, subscription) {
      callback(subscription, err);
    })
  },
  /*
  delSubscription: function (channel_id, userid, callback) {
    subscriptionModel.remove({
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
    if (userid==undefined) {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is undefined');
      callback([], 'userid is undefined');
      return;
    }
    if (userid=='') {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is empty');
      callback([], 'userid is empty');
      return;
    }
    var ref=this;
    userid=parseInt(userid); // ensure it's a number at this point
    if (isNaN(userid)) {
      console.log('dataaccess.caminte.js::getUserSubscriptions - userid is NaN');
      callback([], 'userid is NaN');
      return;
    }
    //console.log('dataaccess.caminte.js::getUserSubscriptions - userid', userid);

    // we actually not sort by id but by the "most recent post first"

    //applyParams(query, params, callback)
    var query=subscriptionModel.find().where('userid', userid).where('active', true);
    applyParams(query, params, callback);

    /*function(subs, err, meta) {
    //applyParams(postModel.find().where('id', { nin: ourRepostIds }).where('userid',{ in: userids }), params, maxid, callback);
    //subscriptionModel.find({ where: { userid: userid, active: true } }, function(err, subs) {
      callback(subs, err, meta); */
      /*
      // FIXME: lookup should be in dispatcher for caching reasons
      // and that means we need to do the sorting in dispatcher
      var channelids=[];
      for(var i in subs) {
        var sub=subs[i];
        channelids.push(sub.channelid);
      }
      //console.log('dataaccess.caminte.js::getUserSubscriptions - channelids are', channelids);
      if (channelids.length) {
        //console.log('dataaccess.caminte.js::getUserSubscriptions - channelids is', channelids);
        var channelCriteria={ where: { id: { in: channelids } } };
        if (params.types) {
          channelCriteria.where['type']={ in: params.types.split(/,/) };
          //console.log('dataaccess.caminte.js::getUserSubscriptions - types', channelCriteria.where['type']);
        }
        channelModel.find(channelCriteria, function (err, channels) {
          callback(channels, err, meta);
        });
      } else {
        // no subs
        callback([], '', meta);
      }
      */
    //});
  },
  getChannelSubscriptionCount: function(channelids, callback) {
    if (channelids==undefined) {
      console.log('dataaccess.caminte.js::getChannelSubscriptionCount - channel id is undefined');
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptionCount - channel id is undefined');
      return;
    }
    // FIXME: how slow is this on innodb...
    subscriptionModel.count({ where: { 'channelid': { in: channelids }, 'active': true } }, callback);
  },
  // get all subscription records
  getChannelSubscriptions: function(channelids, params, callback) {
    if (channelids==undefined) {
      console.log('dataaccess.caminte.js::getChannelSubscriptions - channel id is undefined');
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptions - channel id is undefined');
      return;
    }
    //console.log('dataaccess.caminte.js::getChannelSubscriptions - channelids', channelids);
    /*
    var query=subscriptionModel.find().where('channelid', { in: channelids }).where('active', true);
    //console.log('dataaccess.caminte.js::getChannelSubscriptions - query', query);
    applyParams(query, params, callback);
    */
    subscriptionModel.find({ where: { channelid: { in: channelids }, active: true } }, callback);
    /*
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
      return;
    }
    callback(null, null);
    */
  },
  // paged version for public usage
  getChannelSubscriptionsPaged: function(channelid, params, callback) {
    if (channelids==undefined) {
      console.log('dataaccess.caminte.js::getChannelSubscriptionsPaged - channel id is undefined');
      callback(null, 'dataaccess.caminte.js::getChannelSubscriptionsPaged - channel id is undefined');
      return;
    }
    //console.log('dataaccess.caminte.js::getChannelSubscriptions - channelids', channelids);
    var query=subscriptionModel.find().where('channelid', { in: channelids }).where('active', true);
    //console.log('dataaccess.caminte.js::getChannelSubscriptions - query', query);
    applyParams(query, params, callback);
    /*
    if (this.next) {
      this.next.getChannelSubscriptions(channelid, params, callback);
      return;
    }
    callback(null, null);
    */
  },
}
