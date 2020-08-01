// for pomf support
const request = require('request')
const multer  = require('multer')
const storage = multer.memoryStorage()

module.exports = {
  mount: function(prefix, app) {
    const dispatcher = app.dispatcher
    const callbacks = app.callbacks

    const upload = multer({ storage: storage, limits: { fileSize: app.config.maxUploadSize } })

    app.put(prefix + '/files', function(req, resp) {
      console.log('dialect.appdotnet_official.js:PUT/files - detect')
      const res = {
        meta: {
          code: 401,
          error_message: 'not implemented yet'
        }
      }
      resp.status(res.meta.code).type('application/json').send(JSON.stringify(res))
    })

    // create file (for attachments)
    app.post(prefix + '/files', upload.single('content'), function(req, resp) {
      if (req.file) {
        console.log('POSTfiles - file upload got', req.file.buffer.length, 'bytes')
      } else {
        // no files uploaded
        console.log('POSTfiles - file upload got no content file')
        const res = {
          meta: {
            code: 400,
            error_message: 'No file uploaded'
          }
        }
        resp.status(400).type('application/json').send(JSON.stringify(res))
        return
      }
      if (!req.file.buffer.length) {
        // no files uploaded
        console.log('POSTfiles - file upload got file with 0 bytes')
        const res = {
          meta: {
            code: 400,
            error_message: 'No file uploaded'
          }
        }
        resp.status(400).type('application/json').send(JSON.stringify(res))
        return
      }
      //console.log('looking for type - params:', req.params, 'body:', req.body);
      // type is in req.body.type
      //console.log('POSTfiles - req token', req.token);
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) {
          console.log('dialect.appdotnet_official.js:POSTfiles - token err', err)
        }
        if (usertoken == null) {
          console.log('dialect.appdotnet_official.js:POSTfiles - no token')
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          resp.status(401).type('application/json').send(JSON.stringify(res))
        } else {
          if (req.body.type === undefined) {
            // spec doesn't say required
            req.body.type = ''
          }
          console.log('dialect.appdotnet_official.js:POSTfiles - uploading to pomf')
          const uploadUrl = dispatcher.appConfig.provider_url
          request.post({
            url: uploadUrl,
            formData: {
              //files: fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'),
              'files[]': {
                value: req.file.buffer,
                options: {
                  filename: req.file.originalname,
                  contentType: req.file.mimetype,
                  knownLength: req.file.buffer.length
                }
              }
            }
          }, function(err, uploadResp, body) {
            if (err) {
              console.log('dialect.appdotnet_official.js:POSTfiles - pomf upload Error!', err)
              const res = {
                meta: {
                  code: 500,
                  error_message: 'Could not save file (Could not POST to POMF)'
                }
              }
              resp.status(res.meta.code).type('application/json').send(JSON.stringify(res))
            } else {
              //console.log('URL: ' + body);
              /*
              {"success":true,"files":[
                {
                  "hash":"107df9aadaf6204789f966e1b7fcd31d75a121c1",
                  "name":"mysql.png",
                  "url":"https:\/\/my.pomf.cat\/yusguk.png",
                  "size":13357
                }
              ]}
              {
                success: false,
                errorcode: 400,
                description: 'No input file(s)'
              }
              */
              let data = {}
              try {
                data = JSON.parse(body)
              } catch (e) {
                console.log('couldnt json parse body', body)
                const res = {
                  meta: {
                    code: 500,
                    error_message: 'Could not save file (POMF did not return JSON as requested)'
                  }
                }
                resp.status(res.meta.code).type('application/json').send(JSON.stringify(res))
                return
              }
              if (!data.success) {
                const res = {
                  meta: {
                    code: 500,
                    error_message: 'Could not save file (POMF did not return success)'
                  }
                }
                resp.status(res.meta.code).type('application/json').send(JSON.stringify(res))
                return
              }
              //, 'from', body
              console.log('dialect.appdotnet_official.js:POSTfiles - pomf result', data)
              for (const i in data.files) {
                const file = data.files[i]
                // write this to the db dude
                // dispatcher.appConfig.provider_url+
                // maybe pomf.cat doesn't add the prefix
                // but mixtape does
                // just normalize it (add and strip it, it'll make sure it's always there)
                //file.url = dispatcher.appConfig.provider_url + file.url.replace(dispatcher.appConfig.provider_url, '');
                // that probably won't be the download URL
                //file.url <= passes through
                //file.size <= passes through
                //file.name <= passes through
                // copy
                file.sha1 = file.hash // hash is sha1
                file.mime_type = req.file.mimetype
                // there's only image or other
                file.kind = req.file.mimetype.match(/image/i) ? 'image' : 'other'
                // if it's an image or video, we should get w/h
                //console.log('type', req.body.type, typeof(req.body.type)); // it's string...
                // warn if body.type is empty because it'll crash the server
                file.type = req.body.type
                dispatcher.addFile(file, usertoken, req.apiParams, callbacks.fileCallback(resp, req.token))
              }
            }
            //console.log('Regular:', fs.createReadStream(__dirname+'/git/caminte/media/mysql.png'));
          })
        }
      })
    })

    // Token: User, Scope: files
    app.get(prefix + '/users/me/files', function(req, resp) {
      // req.token
      // req.token convert into userid/sourceid
      dispatcher.getUserClientByToken(req.token, function(err, usertoken) {
        if (err) console.error('files.routes.js::getFILES - getUserClientByToken err', err)
        //console.log('usertoken', usertoken);
        if (usertoken == null) {
          // could be they didn't log in through a server restart
          const res = {
            meta: {
              code: 401,
              error_message: 'Call requires authentication: Authentication required to fetch token.'
            }
          }
          return resp.status(401).type('application/json').send(JSON.stringify(res))
        }
        // This endpoint accepts the interaction_actions as a query string parameter whose value
        // is a comma separated list of actions you're interested in. For instance, if you're
        // only interested in repost and follow interactions you could request
        // users/me/interactions?interaction_actions=repost,follow.

        // I don't think we want to pass the full token
        // wut? why not?

        dispatcher.getFiles(usertoken.userid, req.apiParams, callbacks.dataCallback(resp))
      })
    })
  }
}
