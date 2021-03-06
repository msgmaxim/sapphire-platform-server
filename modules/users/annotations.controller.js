module.exports = {
  /** annotations */
  getAnnotation: function(type, id, callback) {
    //console.log('annotations.controller.js::getAnnotations - type', type, 'id', id)
    const ref = this
    const debug = false
    //if (id === 1861) debug = true
    this.cache.getAnnotations(type, id, function(err, notes, meta) {
      if (err) console.error('annotations.controller.js::getAnnotations - err', err)
      //if (debug) console.log(type, id, 'start notes', notes)
      //var fixedNotes=[]
      if (!notes || !notes.length) {
        callback(err, notes, meta)
        return
      }

      const done = {}; const calls = {}
      let replaces = 0
      let fixedSet

      function checkDone(i) {
        done[i]++
        if (debug) console.log('(', type, id, ')', i, 'done', done[i], 'calls', calls[i])
        if (done[i] === calls[i]) {
          // replace value
          notes[i].value = fixedSet
          replaces++
          //console.log('annotations.controller.js::getAnnotation(', type, id, ') - checkdone replaces', replaces, 'notes', notes.length)
          if (replaces === notes.length) {
            //console.log('annotations.controller.js::getAnnotation(', type, id, ') - final notes', JSON.parse(JSON.stringify(notes)))
            callback(err, notes, meta)
          }
        }
      }

      //if (debug) console.log('annotations.controller.js::getAnnotation(', type, id, ') - notes', notes.length)
      for (const i in notes) {
        // check values
        fixedSet = {}
        notes[i].value = JSON.parse(notes[i].value)
        const oldValue = notes[i].value
        calls[i] = 0
        done[i] = 0
        // is notes[i].value is a key value tuple, not an array
        if (debug) console.log('dispatcher.js::getAnnotation - note', i, 'has', notes[i].value)
        calls[i] += Object.keys(notes[i].value).length
        /*
        for (const k in notes[i].value) {
          calls[i]++
        }
        */
        // I think we only every have one value
        // nope because you can have an empty array
        if (debug) console.log(i, 'value', notes[i].value, 'len', notes[i].value.length, typeof (notes[i].value), notes[i].value.constructor.name)
        if (notes[i].value.constructor.name === 'Array' && !notes[i].value.length) {
          if (debug) console.log('checkDone cause empty array', i)
          fixedSet = notes[i].value
          calls[i]++
          checkDone(i)
          continue
        }
        if (JSON.stringify(notes[i].value) === '{}') {
          if (debug) console.log('checkDone cause empty object', i)
          fixedSet = notes[i].value
          calls[i]++
          checkDone(i)
          continue
        }
        for (const k in notes[i].value) {
          //console.log('value', notes[i].value, 'vs', oldValue, 'k', k, 'val', notes[i].value[k], 'vs', oldValue[k])
          if (k[0] === '+') {
            if (k === '+net.app.core.file') {
              // look up file
              ;
              (function(k, oldValue, fixedSet, i) {
                //console.log('oldValue', oldValue)
                //console.log('looking up', oldValue[k].file_id)
                ref.cache.getFile(oldValue[k].file_id, function(fErr, fData, fMeta) {
                  if (fErr) {
                    console.error('getFile error', fErr)
                  }
                  //console.log('looking at', oldValue)
                  //console.log('looking at', oldValue[k])
                  if (fData)  {
                    fixedSet.file_id = oldValue[k].file_id
                    fixedSet.file_token = oldValue[k].file_token
                    fixedSet.url = fData.url
                    if (notes[i].type === 'net.app.core.oembed') {
                      if (fData.kind === 'image') {
                        fixedSet.type = 'photo'
                        fixedSet.version = '1.0'
                        fixedSet.width = 128
                        fixedSet.height = 128
                        fixedSet.thumbnail_url = fData.url
                        fixedSet.thumbnail_url_secure = fData.url
                        //fixedSet.thumbnail_url_immediate=fData.url
                        fixedSet.thumbnail_width = 128
                        fixedSet.thumbnail_height = 128
                        fixedSet.title = fData.name
                        // author_name from the external site
                        // author_url for the external site
                        fixedSet.provider = ref.appConfig.provider
                        fixedSet.provider_url = ref.appConfig.provider_url
                        fixedSet.embeddable_url = fData.url
                      }
                    }
                  } else {
                    console.log('file', oldValue[k].file_id, 'not found')
                  }
                  checkDone(i)
                })
              }(k, oldValue, fixedSet, i))
            }
          } else {
            //console.log('annotations.controller.js::getAnnotation - note', i, 'value', k, 'copying', notes[i].value[k])
            fixedSet[k] = notes[i].value[k]
            checkDone(i)
          }
        }

        //fixedNotes.push()
      }
    })
  },
  setAnnotations: function(type, id, annotations, callback) {
    //console.log('annotations.controller.js::setAnnotations - id', id, 'annotations', annotations)
    // probably should clear all the existing anntations for this ID
    // channel annotations mutable
    // and we don't have a unique constraint to tell if it's an add or update or del
    const ref = this
    //console.log('annotations.controller.js::setAnnotations - annotations', annotations)
    //console.log('annotations.controller.js::setAnnotations - clearing', type, id)
    this.cache.clearAnnotations(type, id, function() {
      for (const i in annotations) {
        const note = annotations[i]
        //console.log('annotations.controller.js::setAnnotations - note', i, note)
        // insert into idtype, id, type, value
        // type, id, note.type, note.value
        //console.log('dispatcher.js::setAnnotations - insert', note.type, note.value)
        if (!note.value) {
          //console.log('annotations.controller.js::setAnnotations - deleting annotation')
          continue // support deleting annotations
        }
        ref.cache.addAnnotation(type, id, note.type, note.value, function(err, nNote) {
          if (err) {
            console.error('annotations.controller.js::setAnnotations - addAnnotation failure', err)
          //} else {
          }
          //console.log('annotations.controller.js::setAnnotations - addAnnotation', JSON.parse(JSON.stringify(nNote)))
          if (this.notsilent) {
            process.stdout.write('a')
          }
          /*
          if (note.value.length) {
            writevaluearray(id, note.value)
          }
          */
        })
      }
      if (callback) {
        // what would we return??
        callback()
      }
    })
  }
}
