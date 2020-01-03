// http://stackoverflow.com/a/30970751
function escapeHTML(s) {
  return s.replace(/[&"<>]/g, function (c) {
    return {
      '&': "&amp;",
      '"': "&quot;",
      '<': "&lt;",
      '>': "&gt;"
    }[c]
  })
}

module.exports = {
  /** text process */
  // postcontext (bool) means this is a post
  // FIXME: pass in if it's a machine_only or not
  textProcess: function(text, entities, postcontext, callback) {
    var ref=this
    var html=escapeHTML(text)
    //console.log('dispatcher.js::textProcess - html', html)
    var hashtags=[]
    var links=[]
    // from patter @duerig
    // FIXME: these text ranges aren't very i8n friendly, what about UTF stuff huh?
    var mentionRegex = /@([a-zA-Z0-9\-_]+)\b/g
    var hashtagRegex = /#([a-zA-Z0-9\-_]+)\b/g
    // https://gist.github.com/gruber/8891611
    // https://alpha.app.net/dalton/post/6597#6595
    var urlRegex = /\b((?:https?:(?:\/{1,3}|[a-z0-9%])|[a-z0-9.\-]+[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\/)(?:[^\s()<>{}\[\]]+|\([^\s()]*?\([^\s()]+\)[^\s()]*?\)|\([^\s]+?\))+(?:\([^\s()]*?\([^\s()]+\)[^\s()]*?\)|\([^\s]+?\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])|(?:[a-z0-9]+(?:[.\-][a-z0-9]+)*[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\b\/?))/ig

    // data-mention-id="$1" will have to do a look up pass and set this back
    //html = html.replace(mentionRegex, '<span data-mention-name="$1" itemprop="mention">@$1</span>')

    // since input is text, I believe we can safely assume it's not already in a tag
    // FIXME: we need to insert http:// if there's no protocol (post: 30795290)
    // be sure to check your html/entity caching to make sure it's off otherwise 30795290 is fine
    //html = html.replace(urlRegex, '<a href="$1">$1</a>')
    // since hash can be in a link, make sure we process hashtags last
    //html = html.replace(hashtagRegex, '<span data-hashtag-name="$1" itemprop="hashtag">#$1</span>')
    var re = [
      "@([a-zA-Z0-9\-_]+)\\b",
      "\\b((?:https?:(?:\\/{1,3}|[a-z0-9%])|[a-z0-9.\\-]+[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\\/)(?:[^\\s()<>{}\\[\\]]+|\\([^\\s()]*?\\([^\\s()]+\\)[^\\s()]*?\\)|\\([^\\s]+?\\))+(?:\\([^\\s()]*?\\([^\\s()]+\\)[^\\s()]*?\\)|\\([^\\s]+?\\)|[^\\s`!()\\[\\]{};:'\".,<>?«»“”‘’])|(?:[a-z0-9]+(?:[.\\-][a-z0-9]+)*[.](?:com|net|org|edu|gov|mil|aero|asia|biz|cat|coop|info|int|jobs|mobi|museum|name|post|pro|tel|travel|xxx|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|dd|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|Ja|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zw)\\b\\/?))",
      "#([a-zA-Z0-9\-_]+)\\b",
    ]
    //console.log('array', re)
    //console.log('string', re.join('|'))
    re = new RegExp(re.join('|'), "gi")
    html = html.replace(re, function(match, mention, link, hash) {
      //console.log('html replace', match)
      //console.log('html mention', mention)
      //console.log('html link', link)
      //console.log('html hash', hash)
      if (mention) {
        return '<span data-mention-name="'+mention+'" itemprop="mention">@'+mention+'</span>'
      }
      if (link) {
        if (!link.match(/:\/\//)) {
          link = 'http://'+link
        }
        return '<a href="'+link+'">'+link+'</a>'
      }
      if (hash) {
        return '<span data-hashtag-name="'+hash+'" itemprop="hashtag">#'+hash+'</span>'
      }
      return match
    })

    var userlookup={}

    var finishcleanup=function(html, text, callback) {
      if (!entities) {
        entities={
          mentions: [],
          hashtags: [],
          links: []
        }
      }
      //|| entities.parse_mentions isn't spec
      //should be on if not machine_only
      if (!entities.mentions || !entities.mentions.length) {
        // extract mentions
        var mentions=[]
        var lastmenpos=0
        while(match=mentionRegex.exec(text)) {
          //console.log('Found '+match[1]+' at '+match.index)
          var username=match[1].toLowerCase()
          //console.log('@'+match.index+' vs '+lastmenpos)
          if (userlookup[username]) {
            // only push if user exists
            var obj={
              pos: match.index,
              id: ''+userlookup[username],
              len: username.length+1, // includes char for @
              name: username,
            }
            if (postcontext) {
              // means no text before the mention...
              obj.is_leading=match.index==lastmenpos
            }
            mentions.push(obj)
          }
          // while we're matching
          if (match.index==lastmenpos) {
            // update it
            lastmenpos=match.index+username.length+2 // @ and space after wards
          }
        }
        entities.mentions=mentions
      }
      // we should do links before hashtags
      // since a # can be inside a link
      if (!entities.links || !entities.links.length || entities.parse_links) {
        // extract URLS
        var links=[]
        while(match=urlRegex.exec(text)) {
          var url=match[1]
          // we need to insert http:// if there's no protocol (post: 30795290)
          // FIXME: colon isn't good enough
          var text=url
          if (url.indexOf('://')==-1) {
            url='http://'+url
          }
          var obj={
            url: url,
            text: text,
            pos: match.index,
            len: text.length,
          }
          links.push(obj)
        }
        entities.links=links
      }

      //console.log('current hashtags', entities.hashtags)
      //|| entities.parse_hashtags isn't spec
      // should always be on
      if (!entities.hashtags || !entities.hashtags.length) {
        // extract hashtags
        //console.log('extracting hashtags')
        // FIXME: 30792555 invisible hashtags?
        // we're not encoding text right...
        var hashtags=[]
        while(match=hashtagRegex.exec(text)) {
          var hashtag = match[1]
          var insideLink = false
          for(var i in entities.links) {
            var link = entities.links[i]
            var start=link.pos
            var end=start + link.len
            //console.log('hash start inside link?', start, '<?', match.index, '<?', end)
            if (start <= match.index && match.index <= end) {
              //console.log('hash end inside link?', start, '<?', match.index+hashtag.length+1, '<?', end)
              if (start <= match.index + hashtag.length+1 && match.index + hashtag.length+1 <= end) {
                //console.log('hashtag', hashtag, 'is in link', link.url)
                insideLink = true
                break
              }
            }
          }
          if (insideLink) {
            continue
          }
          var obj={
            name: hashtag,
            pos: match.index,
            len: hashtag.length+1, // includes char for #
          }
          //console.log('extracted hashtag:', hashtag)
          hashtags.push(obj)
        }
        //console.log('extracted hashtags', hashtags)
        entities.hashtags=hashtags
      }

      /*
      console.dir(mentions)
      console.dir(hashtags)
      console.dir(links)
      */

      // unicode chars
      // <>\&
      //console.log('dispatcher.js::textProcess - html unicoding', html)
      html = html.replace(/[\u00A0-\u9999]/gim, function(i) {
        if (i === 's') return 's'
        if (i.charCodeAt(0) == 115) return 's'
        console.log('i', i, 'code', i.charCodeAt(0))
        return '&#'+i.charCodeAt(0)+';'
      })

      // remove line breaks
      //console.log('dispatcher.js::textProcess - html line breaking', html)
      html=html.replace(/\r/g, '&#10;')
      html=html.replace(/\n/g, '<br>')

      //console.log('dispatcher.js::textProcess - html wrapping', html)
      var res={
        entities: entities,
        html: '<span itemscope="https://app.net/schemas/Post">'+html+'</span>',
        text: text
      }
      callback(res, null)
    }

    var mentionsSrch=text.match(mentionRegex)
    var launches=0, completed=0
    if (mentionsSrch && mentionsSrch.length) {
      for(var i in mentionsSrch) {
        var mention=mentionsSrch[i] // with @
        //RegExp.$1 // without @
        //var username=RegExp.$1
        var username=mention.substr(1)
        //console.log("Replacing "+username)
        var pattern=new RegExp(' data-mention-name="'+username, 'gi')
        launches++
        // renames are going to break this caching
        if (userlookup[username]) {
          console.log('cached got', userlookup[username])
          html=html.replace(pattern, ' data-mention-id="'+userlookup[username]+'" data-mention-name="'+username)
          completed++
          if (completed==launches) {
            finishcleanup(html, text, callback)
          }
        } else {
          //console.log('dispatcher.js::textProcess - Searching for', username)
          ref.cache.getUserID(username, function(userErr, user, userMeta) {
            if (user) {
              //console.log('dispatcher.js::textProcess -got', user.id)
              // save in cache
              userlookup[user.username]=user.id
              // fix up missing user ids
              //var pattern=new RegExp(' data-mention-name="'+user.username, 'gi')
              html=html.replace(pattern, ' data-mention-id="'+user.id+'" data-mention-name="'+user.username)
              //console.log('Adjusted html '+html)
            }
            completed++
            //console.log(completed+'/'+launches)
            // tired/lazy man's promise
            // I'm concerned that if we queue 2 and then finish 2, we may trigger the ending early
            // and possibly more than once
            if (completed==launches) {
              finishcleanup(html, text, callback)
            }
          })
        }
      }
    } else {
      finishcleanup(html, text, callback)
    }
  },
}
