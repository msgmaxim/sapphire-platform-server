/**
 * Helper function for copying entities around
 * @param {string} type - type of entity (mentions, hashtags, links)
 * @param {object} src - source entities array
 * @param {object} dest - destination entities array
 * @param {boolean} postcontext - are we a in a post context (versus user context)
 */
function copyentities(type, src, dest, postcontext) {
  if (!dest) {
    console.log('entities.controller.js::copyentities - dest not set ', dest)
    return
  }
  // dest.entities[type]=[]
  for (const i in src) {
    const res = src[i]
    const obj = {}
    switch (type) {
      case 'mentions':
        // need is_leading only for post context
        if (postcontext && res.altnum !== undefined) {
          obj.is_leading = !!res.altnum
        }
        obj.id = '' + res.alt // could be a hint of future issues here
        obj.name = res.text
        break
      case 'hashtags':
        obj.name = res.text
        break
      case 'links':
        obj.url = res.alt
        obj.text = res.text
        if (res.altnum) {
          obj.amended_len = parseInt(0 + res.altnum)
        }
        break
      default:
        console.log('unknown type ' + type)
        break
    }
    obj.pos = parseInt(0 + res.pos)
    obj.len = parseInt(0 + res.len)
    dest.entities[type].push(obj)
  }
}

module.exports = {
  copyentities: copyentities,
  /** entities */
  getEntities: function(type, id, callback) {
    this.cache.getEntities(type, id, callback)
  },
  setEntities: function(type, id, entities, callback) {
    //console.dir('entities.controller.js::setEntities - '+type, entities)
    let mentionsDone = false
    let hashtagsDone = false
    let linksDone = false
    function checkDone() {
      if (mentionsDone && hashtagsDone && linksDone) {
        if (callback) {
          callback()
        }
      }
    }
    // I'm pretty sure these arrays are always set
    if (entities.mentions && entities.mentions.length) {
      this.cache.extractEntities(type, id, entities.mentions, 'mention', function(err, nEntities, meta) {
        if (err) console.error('entities.controller.js::setEntities - mentions err', err)
        mentionsDone = true
        checkDone()
      })
      if (this.notsilent) {
        process.stdout.write('@')
      }
    } else {
      mentionsDone = true
      checkDone()
    }
    if (entities.hashtags && entities.hashtags.length) {
      this.cache.extractEntities(type, id, entities.hashtags, 'hashtag', function(err, nEntities, meta) {
        if (err) console.error('entities.controller.js::setEntities - hashtags err', err)
        hashtagsDone = true
        checkDone()
      })
      if (this.notsilent) {
        process.stdout.write('#')
      }
    } else {
      hashtagsDone = true
      checkDone()
    }
    if (entities.links && entities.links.length) {
      this.cache.extractEntities(type, id, entities.links, 'link', function(err, nEntities, meta) {
        if (err) console.error('entities.controller.js::setEntities - links err', err)
        linksDone = true
        checkDone()
      })
      if (this.notsilent) {
        process.stdout.write('^')
      }
    } else {
      linksDone = true
      checkDone()
    }
  }
}
