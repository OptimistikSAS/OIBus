const minimist = require('minimist')
const fs = require('fs')
const JSON5 = require('json5')

/**
 * Tries to read a file at a given path
 * @param {String} path - Path to the file to read
 * @return {*} Content of the file
 */
const tryReadFile = (path) => {
  if (!path.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return new Error('You must provide a json file for the configuration!')
  }
  try {
    return JSON5.parse(fs.readFileSync(path, 'utf8')) // Get fTbus configuration file
  } catch (error) {
    console.error(error)
    return error
  }
}

/**
 * Checks if the right arguments have been passed to the command
 * @param {Object} args - Arguments of the command
 * @return {boolean} - Whether the right arguments have been passed or not
 */
const isValidArgs = ({ config }) => {
  if (!config) {
    console.error('No config file specified, example: --config ./config/config.json')
    return false
  }
  return true
}

/**
 * Retrieves the arguments passed to the command
 * @return {Object} args - Retrieved arguments, or null
 */
const parseArgs = () => {
  const args = minimist(process.argv.slice(2))

  if (isValidArgs(args)) {
    return args
  }
  return null
}

/**
 * Check if config file exists
 * @param {string} filePath - The location of the config file
 * @return {void}
 */
const checkOrCreateConfigFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.info('Default config file does not exist. Creating it.')
    const defaultConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
    fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 4), 'utf8')
  }
}

module.exports = { parseArgs, tryReadFile, checkOrCreateConfigFile }
