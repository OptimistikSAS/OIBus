const minimist = require('minimist')
const fs = require('fs')
const path = require('path')
const JSON5 = require('json5')

/**
 * Tries to read a file at a given path
 * @param {String} configPath - Path to the file to read
 * @return {*} Content of the file
 */
const tryReadFile = (configPath) => {
  if (!configPath.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return new Error('You must provide a json file for the configuration!')
  }
  try {
    return JSON5.parse(fs.readFileSync(configPath, 'utf8')) // Get OIBus configuration file
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
 * @return {boolean} - Whether it was successful or not
 */
const checkOrCreateConfigFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.info('Default config file does not exist. Creating it.')
    try {
      const defaultConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
      fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 4), 'utf8')
    } catch (error) {
      console.error(error)
    }
  }
}

/**
 * Backup actual config file.
 * @param {string} configFile - The config file
 * @return {void}
 */
const backupConfigFile = (configFile) => {
  const timestamp = new Date().getTime()
  const backupFilename = `${path.parse(configFile).name}-${timestamp}${path.parse(configFile).ext}`
  const backupPath = path.join(path.parse(configFile).dir, backupFilename)
  fs.copyFileSync(configFile, backupPath)
}

/**
 * Save configuration
 * @param {object} config - The config
 * @param {string} configFile - The config file
 * @returns {void}
 */
const saveNewConfig = (config, configFile) => {
  fs.writeFileSync(configFile, JSON.stringify(config, null, 4), 'utf8')
}

module.exports = {
  parseArgs,
  tryReadFile,
  checkOrCreateConfigFile,
  backupConfigFile,
  saveNewConfig,
}
