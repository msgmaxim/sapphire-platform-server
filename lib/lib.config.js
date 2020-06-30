const path  = require('path')
const nconf = require('nconf')

// Look for a config file
var config_path = path.join(__dirname, '../config.json')
// and a model file
var config_model_path = path.join(__dirname, '/config.models.json')
console.log('config-file-path', nconf.get('config-file-path') || config_path)
if (nconf.get('config-file-path') && !fs.existsSync(nconf.get('config-file-path'))) {
  console.warn('config-file-path is set and yet missing...')
  process.exit()
}
nconf.argv().env('__').file('', nconf.get('config-file-path') || config_path )

function moduleEnabled(name) {
  let val = nconf.get('modules:' + name)
  if (val === undefined) val = true
  return val
}

module.exports = {
  moduleEnabled: moduleEnabled,
  nconf: nconf,
}