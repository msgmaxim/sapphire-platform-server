const assert     = require('assert')
const caminte    = require('../dataaccess/caminte_patcher.js')
const configUtil = require('../lib/lib.config.js')

// would need a mysql server to test those patches
// one could be in config.json

const zeroDate = new Date(0)

function runSchemaTest(Test) {
  it('create records', async() => {
    await Test.create({ inactive: zeroDate })
    await Test.create({ inactive: zeroDate.getTime() })
    await Test.create({ inactive: null })
    await Test.create({ inactive: new Date() })
  })
  it('counts', () => {
    Test.count({ where: { inactive: null } }, function(err, count) {
      // console.log('Nulls', count)
      assert.equal(1, count)
    })
    Test.count({ where: { inactive: zeroDate } }, function(err, count) {
      // console.log('Zeros', count)
      assert.equal(1, count)
    })
    Test.count({ where: { inactive: zeroDate.getTime() } }, function(err, count) {
      // console.log('Zeros', count)
      assert.equal(1, count)
    })
    Test.count({ where: { inactive: { ne: null } } }, function(err, count) {
      assert.equal(3, count)
    })
  })
  it('all', () => {
    Test.all(function(err, tests) {
      // console.log('tests', tests)
      assert.equal(4, tests.length)
    })
  })
  it('find', () => {
    // this tries to cast null to date and fails...
    Test.find({ where: { inactive: null } }, function(err, tests) {
      assert.equal(1, tests.length)
    })
    Test.find({ where: { inactive: zeroDate } }, function(err, tests) {
      assert.equal(1, tests.length)
    })
    Test.find({ where: { inactive: zeroDate.getTime() } }, function(err, tests) {
      assert.equal(1, tests.length)
    })
    Test.find({ where: { inactive: { ne: null } } }, function(err, tests) {
      //console.log('find ne null', tests)
      assert.equal(3, tests.length)
    })
  })
}

describe('test caminte memory patches', () => {
  let schema, Test
  schema = caminte.cfgCaminteConn('memory')
  Test = schema.define('test', {
    inactive: { type: schema.Date }
  })
  runSchemaTest(Test)
})

// did we started unified?
// where is /sapphire/v1/config
// you can't find /sapphire/v1/config without knowing config.json path
// unless you did the localhost registry webserver trick...
/*
const nconf = configUtil.nconf
const defaultSchemaType = nconf.get('database:default:type') || 'memory'
const schemaDataType    = nconf.get('database:dataModel:type') || defaultSchemaType
const schemaTokenType   = nconf.get('database:tokenModel:type') || defaultSchemaType
let mysqlConfig = false
if (schemaDataType.toLowerCase() === 'mysql') {
  const defaultOptions = nconf.get('database:default:options')
  mysqlConfig = nconf.get('database:dataModel:options') || defaultOptions
}
if (schemaTokenType.toLowerCase() === 'mysql') {
  const defaultOptions = nconf.get('database:default:options')
  mysqlConfig = nconf.get('database:tokenModel:options') || defaultOptions
}

if (mysqlConfig) {
  describe('test caminte memory patches', () => {
  })
}
*/
