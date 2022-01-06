const path = require('path')
const fs = require('fs')

const minimist = require('minimist')

const EncryptionService = require('./EncryptionService.class')
const Logger = require('../engine/logger/Logger.class')

/**
 * Class responsible for managing the configuration.
 * @class ConfigService
 * @param {Engine} engine - The Engine
 * @param {string} configFile - The config file
 * @return {void}
 */
class ConfigService {
  constructor(engine, configFile) {
    this.engine = engine
    this.logger = Logger.getDefaultLogger()
    this.encryptionService = EncryptionService.getInstance()

    this.configFile = configFile

    const baseDir = path.extname(this.configFile) ? path.parse(this.configFile).dir : this.configFile
    if (!fs.existsSync(baseDir)) {
      this.logger.info(`Creating folder ${baseDir}`)
      fs.mkdirSync(baseDir, { recursive: true })
    }

    this.checkOrCreateConfigFile(this.configFile) // Create default config file if it doesn't exist

    this.config = ConfigService.tryReadFile(this.configFile, this.logger)
    this.modifiedConfig = this.duplicateConfig(this.config)

    this.keyFolder = path.join(this.config.engine.caching.cacheFolder, 'keys')
  }

  /**
   * Get config file from console arguments
   * @param {Object} logger - The logger
   * @returns {string} - the config file
   */
  static getCommandLineArguments(logger) {
    const args = minimist(process.argv.slice(2))
    const { config, check } = args
    if (!config) {
      logger.error('No config file specified, example: --config ./config/config.json')
    }
    return { configFile: path.resolve(config ?? './oibus.json'), check }
  }

  /**
   * Tries to read a file at a given path
   * @param {string} filePath - The location of the config file
   * @param {Object} logger - The logger
   * @return {*} Content of the file
   */
  static tryReadFile(filePath, logger) {
    if (!filePath.endsWith('.json')) {
      logger.error('You must provide a json file for the configuration!')
      throw new Error('You must provide a json file for the configuration!')
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) // Get OIBus configuration file
    } catch (error) {
      logger.error(error)
      throw error
    }
  }

  /**
   * Backup the configuration file.
   * @param {string} configFile - The config file
   * @returns {void}
   */
  static backupConfigFile(configFile) {
    // Backup config file
    const timestamp = new Date().getTime()
    const backupFilename = `${path.parse(configFile).name}-${timestamp}${path.parse(configFile).ext}`
    const backupPath = path.join(path.parse(configFile).dir, backupFilename)
    fs.copyFileSync(configFile, backupPath)
  }

  /**
   * Save the configuration.
   * @param {string} configFile - The file path where to save the configuration
   * @param {object} config - The configuration
   * @returns {void}
   */
  static saveConfig(configFile, config) {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 4), 'utf8')
  }

  /**
   * Get config.
   * @returns {object} - The config
   */
  getConfig() {
    return {
      engineConfig: this.config.engine,
      southConfig: this.config.south,
      northConfig: this.config.north,
    }
  }

  /**
   * Check if config file exists
   * @param {string} filePath - The location of the config file
   * @return {boolean} - Whether it was successful or not
   */
  /* eslint-disable-next-line class-methods-use-this */
  checkOrCreateConfigFile(filePath) {
    if (!fs.existsSync(filePath)) {
      this.logger.info('Default config file does not exist. Creating it.')
      try {
        const defaultConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
        fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 4), 'utf8')
      } catch (error) {
        this.logger.error(error)
      }
    }
  }

  /**
   * Make a deep copy to prevent overwriting the actual config when working on modifiedConfig
   * @param {Object} config - The config to duplicate
   * @returns {Object} - The duplicated config
   */
  duplicateConfig(config) {
    try {
      return JSON.parse(JSON.stringify(config))
    } catch (error) {
      this.logger.error(error)
      throw error
    }
  }

  /**
   * Get active configuration.
   * @returns {object} - The active configuration
   */
  getActiveConfiguration() {
    return this.config
  }

  /**
   * Update Engine
   * @param {object} config - The updated Engine
   * @returns {void}
   */
  updateConfig(config) {
    this.encryptionService.encryptSecrets(config.engine)
    config.north.applications.forEach((application) => {
      this.encryptionService.encryptSecrets(application)
    })
    config.south.dataSources.forEach((dataSource) => {
      this.encryptionService.encryptSecrets(dataSource)
    })
    this.modifiedConfig = config
  }

  /**
   * Activate the configuration
   * @returns {void}
   */
  activateConfiguration() {
    ConfigService.backupConfigFile(this.configFile)
    ConfigService.saveConfig(this.configFile, this.modifiedConfig)
    this.engine.reload(3000)
  }

  /**
   * Get the location of the config file.
   * @returns {string} - The location of the config file
   */
  getConfigurationFileLocation() {
    return this.configFile
  }
}

module.exports = ConfigService
