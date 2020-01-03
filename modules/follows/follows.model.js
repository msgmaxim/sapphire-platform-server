var followModel
let applyParams

function start(options) {
  const schemaData = options.schemaData
  applyParams = options.applyParams
  /** follow storage model */
  followModel = schemaData.define('follow', {
    userid: { type: Number, index: true },
    followsid: { type: Number, index: true }, // maybe not index this
    active: { type: Boolean, index: true },
    // aka pagenationid, we'll need this for meta.id too
    referenceid: { type: Number, index: true }, // this only exists in meta.id and is required for deletes for app streaming
    created_at: { type: Date }, // or this
    last_updated: { type: Date },
  })
}

module.exports = {
  next: null,
  start: start,
  /** follow */
  // is del bool or 1/0? <= doesn't matter
  setFollow: function (srcid, trgid, id, del, ts, callback) {
    // FIXME: ORM issues here...
    // create vs update fields?
    if (srcid && trgid) {

      // do notify
      // could guard but then we'd need more indexes
      // i think we'll be ok if we don't guard for now
      //noticeModel.noticeModel( { where: { created_at: ts, type: type } }, function(err, notify)
      //
      if (del) {
        // remove any evidence of a follow
        this.delNotice({ where: { type: 'follow', actionuserid: srcid, typeid: trgid} })
        /*
        noticeModel.find({ where: { type: 'follow', actionuserid: srcid, typeid: trgid} }, function(err, noticies) {
          for(var i in noticies) {
            var notice=noticies[i]
            notice.destroy(function(err) {
            })
          }
        })
        */
      } else {
        notice = {}
        notice.event_date = ts
        // notify target
        notice.notifyuserid = trgid // who should be notified
        notice.actionuserid = srcid // who took an action
        notice.type = 'follow' // star,repost,reply,follow
        notice.typeid = trgid // postid(star,respot,reply),userid(follow)
        //db_insert(notice, noticeModel)
        this.addNotice(notice)
      }

      //console.log('camintejs.dataaccess::setFollow active - del:', del, 'active:', del?0:1)
      var ref=this
      // FIXME we need to manually detect if it existed, so we can set created_at
      // as that's the main date field that's part of the api
      followModel.updateOrCreate({
        userid: srcid,
        followsid: trgid
      }, {
        userid: srcid,
        followsid: trgid,
        active: del?0:1,
        referenceid: id,
        //created_at: ts,
        last_updated: ts
      }, function(err, users) {
        // now recalculate target user counts
        // maybe even get a count
        // download target user records
        ref.updateUserCounts(srcid, function() {})
        ref.updateUserCounts(trgid, function() {})
        // make changes
        if (callback) {
          callback(err, users, false)
        }
      })
    } else {
      // FIXME: write me
      // search by referenceid, likely delete it
      console.log('dataaccess.caminte.js::setFollow - no data, write me... deleted? '+del)
      if (callback) {
        callback(false, false, false)
      }
    }
    // find (id and status, dates)
    // update or insert
  },
  getAllFollowing: function(userid, callback) {
    if (userid==undefined) {
      console.trace('dataaccess.caminte.js::getFollowing - userid is undefined')
      callback('dataaccess.caminte.js::getFollowing - userid is undefined')
      return
    }
    followModel.find({ where: { userid: userid, active: 1 } }, function(err, followings) {
      //console.dir(followings)
      if (followings==undefined) {
        if (this.next && this.next.getAllFollowing) {
          this.next.getAllFollowing(userid, callback)
          return
        }
      } else {
        //console.log('got', followings.length, 'followings for', userid)
        callback(err, followings)
      }
    })
  },
  // who is this user following
  getFollowing: function(userid, params, callback) {
    if (userid==undefined) {
      console.trace('dataaccess.caminte.js::getFollowing - userid is undefined')
      callback('dataaccess.caminte.js::getFollowing - userid is undefined')
      return
    }
    // applyParams?
    followModel.find({ where: { userid: userid, active: 1 } }, function(err, followings) {
      //console.dir(followings)
      if (followings==undefined) {
        if (this.next) {
          this.next.getFollowing(userid, params, callback)
          return
        }
      } else {
        //console.log('got', followings.length, 'followings for', userid)
        callback(err, followings)
      }
    })
  },
  follows: function(src, trg, callback) {
    //console.log('dataaccess.caminte.js::follows - src/trg', src, trg)
    if (src==undefined) {
      console.trace('dataaccess.caminte.js::follows - undefined src')
      callback('dataaccess.caminte.js::follows - undefined src')
      return
    }
    if (trg==undefined) {
      console.trace('dataaccess.caminte.js::follows - undefined trg')
      callback('dataaccess.caminte.js::follows - undefined trg')
      return
    }
    followModel.findOne({ where: { userid: src, followsid: trg } }, function(err, followings) {
      callback(err, followings)
    })
  },
  // who follows this user
  getFollows: function(userid, params, callback) {
    if (userid==undefined) {
      console.trace('dataaccess.caminte.js::getFollows - userid is undefined')
      callback('dataaccess.caminte.js::getFollows - userid is undefined')
      return
    }
    //, limit: params.count, order: "last_updated DESC"
    followModel.find({ where: { followsid: userid, active: 1 } }, function(err, followers) {
      if (followers==undefined) {
        if (this.next) {
          this.next.getFollows(userid, params, callback)
          return
        }
      } else {
        callback(false, followers, false)
      }
    })
  },
}
