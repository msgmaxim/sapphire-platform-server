const fs    = require('fs')
const path  = require('path')
const nconf = require('nconf')

const config_path = process.env['config-file-path'] || path.join(__dirname, '../config.json')
// Look for a config file
console.log('lib.config - config-file-path', config_path)
if (!fs.existsSync(nconf.get('config-file-path'))) {
  console.warn('lib.config -', config_path, 'is missing!')
  process.exit()
}
nconf.argv().env('__').file('', config_path)

function moduleEnabled(name) {
  let val = nconf.get('modules:' + name)
  if (val === undefined) val = true
  return val
}

function isQuiet() {
  return nconf.get('logging:quiet') || false
}

function getLoggingPeridoticReports() {
  return !isQuiet() && (nconf.get('logging:peridotic_reports') || true)
}

module.exports = {
  moduleEnabled: moduleEnabled,
  nconf: nconf,
  getLoggingPeridoticReports: getLoggingPeridoticReports,
  isQuiet: isQuiet
}
