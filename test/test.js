const path = require('path')
const nconf = require('nconf')
const assert = require('assert')
const lokinet = require('loki-launcher/lokinet')
const URL = require('url').URL // node 8.x backfill

//require('longjohn')

const ADN_SCOPES = 'stream'

// Look for a config file
const config_path = path.join(__dirname, '/../config.json')
// and a model file
const config_model_path = path.join(__dirname, '/config.models.json')
nconf.argv().env('__').file({file: config_path}).file('model', {file: config_model_path})

const cache = require('../dataaccess/dataaccess.proxy-admin')
cache.start(nconf)
cache.dispatcher = {
  // ignore local user updates
  updateUser: (user, ts, cb) => { cb(user) },
  // ignore local message updates
  setMessage: (message, cb) => { if (cb) cb(message) },
}

let webport = nconf.get('web:port') || 7070
const base_url = 'http://localhost:' + webport + '/'
const platform_admin_url = 'http://' + nconf.get('admin:listen') + ':' + nconf.get('admin:port')
console.log('read', base_url)

let token = ''

const adnServerAPI = require('../fetchWrapper')
const platformApi = new adnServerAPI(base_url)
// do we need this?
const adminApi    = new adnServerAPI(platform_admin_url, nconf.get('admin:modKey'))

// FIXME: username should be configurable
function findOrCreateUser(username) {
  if (!username) return false
  return new Promise((resolve, rej) => {

    // does our test user exist?
    cache.getUserID(username, function(err, user) {
      if (err) {
        console.error('findOrCreateUser::getUserID', err)
        return rej(err)
      }
      console.log('findOrCreateUser::getUserID result', user)
      if (user !== null) {
        //console.log('found user', user)
        return resolve(user.id)
      }
      // create test user
      console.log('creating test user', username)
      cache.addUser(username, '', function(err, user) {
        if (err) {
          console.error('findOrCreateUser::addUser', err)
          return rej(err)
        }
        //console.log('created user', user.toString())
        console.log('created user', user.id)
        resolve(user.id)
      })
    })
  })
}

function findOrCreateToken(userid) {
  if (!userid) return false
  return new Promise((resolve, rej) => {
    cache.createOrFindUserToken(userid, 'mocha_platform_test', ADN_SCOPES, function(err, usertoken) {
      if (err) {
        console.error('findOrCreateToken::addAPIUserToken', err)
        rej(err)
      }
      resolve(usertoken.token)
    })
  })
}

const ensureServer = () => {
  return new Promise((resolve, rej) => {
    const platformURL = new URL(base_url)
    console.log('platform port', platformURL.port)
    lokinet.portIsFree(platformURL.hostname, platformURL.port, function(free) {
      if (free) {
        // we need to configure this to ensure there's an admin api mounted...
        // well we know the config file...
        console.log('server is started')
        const startPlatform = require('../app')
      } else {
        console.log('detected running server')
      }
      resolve()
    })
  })
}

let testUserId

async function setupTesting() {

  describe('ensureServer', async () => {
    it('make sure we have something to test', async () => {
      await ensureServer()
    })
    // need the following in an `it` to make sure it only happens after the server is set up
    it('setting up token to use with testing', async() => {
      testUserId = await findOrCreateUser('test')
      //console.log('testUserId', testUserId);
      if (testUserId === undefined) {
        console.error('Couldnt create/find user to test with');
        process.exit(1);
      }
      token = await findOrCreateToken(testUserId)
      // assert we have a token...
      console.log('got token', token, 'for user @test')
      platformApi.token = token
    })
  })

}

setupTesting()

const testConfig = {
  platformApi,
  testUsername: '@test',
  testUserid: testUserId,
}

describe('#token', async () => {
  require('./test.tokens').runTests(platformApi)
})
  describe('#users', async () => {
    require('./test.users').runTests(platformApi)
  })
    describe('#mutes', async () => {
      require('./test.mutes').runTests(platformApi)
    })
    describe('#posts', async () => {
      require('./test.posts').runTests(platformApi)
    })
      describe('#markers', async () => {
        require('./test.markers').runTests(platformApi)
      })
      describe('#interactions', async () => {
        require('./test.interactions').runTests(platformApi)
      })
    describe('#channels', async () => {
      require('./test.channels').runTests(platformApi)
    })
