const minimist = require('minimist')

/**
 * Checks if the right arguments have been passed to the command
 * @param {Object} args : arguments of the command
 * @return {boolean} : whether the right arguments have been passed or not
 */
const isValidArgs = ({ config }) => {
  if (!config) {
    console.error('No config file specified, exemple: --config ./config/config.json')
    return false
  }
  return true
}

/**
 * Retreives the arguments passed to the command
 * @return {Object} args : retreived arguments, or null
 */
const parseArgs = () => {
  const args = minimist(process.argv.slice(2))

  if (isValidArgs(args)) {
    return args
  }
  return null
}

module.exports = { parseArgs }
