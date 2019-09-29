var interactionModel

function start(schemaData) {
  // split up?
  // we don't need reposts here becauses have all that info with a repost_of column
  // since an entire post is created on repost
  // though repost could also write here in the future, making it easier to pull
  // stars are recorded only here
  /** interaction storage model */
  interactionModel = schemaData.define('interaction', {
    userid: { type: Number, index: true },
    type: { type: String, length: 8, index: true }, // star,unstar,repost,unrepost,delete
    datetime: { type: Date },
    idtype: { type: String, index: true }, // post (what about chnl,msg,user? not for existing types)
    typeid: { type: Number, index: true }, // causing problems?
    asthisid: { type: Number } // meta.id
  })
}

module.exports = {
  next: null,
  start: start,
  /** Star/Interactions */
  addStar: function(postid, token, callback) {
    if (this.next) {
      this.next.addStar(postid, token, callback);
    } else {
      //console.log('dataaccess.caminte.js::addStar - write me!');
      // nope
      console.log('dataaccess.caminte.js::addStar - token: ', token); // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 0, Date.now());
      // we're supposed to return the post
      callback(null, null);
    }
  },
  delStar: function(postid, token, callback) {
    if (this.next) {
      this.next.delStar(postid, token, callback);
    } else {
      //console.log('dataaccess.caminte.js::delStar - write me!');
      console.log('dataaccess.caminte.js::delStar - token: ', token); // obj?
      this.setInteraction(token.userid, postid, 'star', 0, 1, Date.now());
      // we're supposed to return the post
      callback(null, null);
    }
  },
  setInteraction: function(userid, postid, type, metaid, deleted, ts, callback) {
    // is there an existing match for this key (userid, postid, type)
    // wouldn't find or create be better here?
    var ref=this;
    console.log('caminte::setInteractions', userid, postid, type, metaid, deleted);
    interactionModel.find({ where: { userid: userid, typeid: postid, type: type } }, function(err, foundInteractions) {

      function doFinalCheck(interactions, err, meta) {
        var postDone=false;
        var userDone=false;
        function checkDone() {
          if (postDone && userDone) {
            if (callback) {
              callback(interactions, err, meta);
            }
          }
        }
        if (type==='star') {
          // update num_stars
          ref.updatePostCounts(postid, function() {
            postDone=true;
            checkDone();
          });
          // update counts.stars
          ref.updateUserCounts(userid, function() {
            userDone=true;
            checkDone();
          });
        } else {
          postDone=true;
          userDone=true;
          checkDone();
        }
      }
      // already set dude
      console.log('caminte::setInteractions - find', foundInteractions)
      if (foundInteractions && foundInteractions.length) {
        //console.log('caminte::setInteractions - already in db')
        if (deleted) {
          // nuke it
          var done=0
          for(var i in foundInteractions) {
            foundInteractions[i].destroy(function (err) {
              done++;
              if (done===foundInteractions.length) {
                // hiding all errors previous to last one
                doFinalCheck('', err);
              }
            })
          }
        } else {
          doFinalCheck('', null);
        }
        return;
      }

      // ok star,repost
      console.log('camintejs::setInteraction - type',type);
      if (type=='star') {
        // is this the src or trg?
        //console.log('setInteraction - userid',userid);
        // do notify
        // could guard but then we'd need more indexes
        // i think we'll be ok if we don't guard for now
        //noticeModel.noticeModel( { where: { created_at: ts, type: type } }, function(err, notify)

        // first who's object did we interact with
        ref.getPost(postid, function(post, err, meta) {
          notice=new noticeModel();
          notice.event_date=ts;
          // owner of post should be notified
          notice.notifyuserid=post.userid; // who should be notified
          notice.actionuserid=userid; // who took an action
          notice.type=type; // star,repost,reply,follow
          notice.typeid=postid; // postid(star,respot,reply),userid(follow)
          //notice.asthisid=metaid;
          db_insert(notice, noticeModel, function() {
          });
        });
      }

      // is this new action newer
      interaction=new interactionModel();
      interaction.userid=userid;
      interaction.type=type;
      interaction.datetime=ts;
      interaction.idtype='post';
      interaction.typeid=postid;
      interaction.asthisid=metaid;
      //if (foundInteraction.id==null) {
      console.log('camintejs:setInteraction - inserting', interactionModel);
      db_insert(interaction, interactionModel, function(interactions, err, meta) {
        doFinalCheck(interactions, err, meta);
      });
      /*
      } else {
        console.log('setInteraction found dupe', foundInteraction, interaction);
        if (callback) {
          callback('', 'duplicate')
        }
      }
      */
    });
  },
  getUserStarPost: function(userid, postid, callback) {
    // did this user star this post
    //, limit: params.count
    //console.log('camintejs::getUserStarPost', userid, postid);
    interactionModel.find({ where: { userid: userid, type: 'star', typeid: postid, idtype: 'post' } }, function(err, interactions) {
      callback(interactions[0], err);
    });
  },
  // get a list of posts starred by this user (Retrieve Posts starred by a User)
  // https://api.app.net/users/{user_id}/stars
  // getUserStarPosts
  //
  // get a list of users that have starred this post
  // getPostStars
  getPostStars: function(postid, params, callback) {
    interactionModel.find({ where: { type: 'star', typeid: postid, idtype: 'post' }, limit: params.count }, function(err, interactions) {
      /*
      if (interactions==null && err==null) {
        callback(interactions, err);
      } else {
        callback(interactions, err);
      }
      */
      callback(interactions, err);
    });
  },
}
