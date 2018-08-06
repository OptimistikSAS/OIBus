const minimist = require('minimist')
const fs = require('fs')

/**
 * Tries to read a file at a given path
 * @param {String} path : path to the file to read
 * @return {*} : content of the file
 */
const tryReadFile = (path) => {
  if (!path.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return new Error('You must provide a json file for the configuration!')
  }
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8')) // Get fTbus configuration file
  } catch (error) {
    console.error(error)
    return error
  }
}

/**
 * Checks if the right arguments have been passed to the command
 * @param {Object} args : arguments of the command
 * @return {boolean} : whether the right arguments have been passed or not
 */
const isValidArgs = ({ config = './fTbus.config.json' }) => {
  if (!config) {
    console.error('No config file specified, example: --config ./config/config.json')
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

module.exports = { parseArgs, tryReadFile }
