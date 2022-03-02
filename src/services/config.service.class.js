const path = require('path')
const fs = require('fs')

const minimist = require('minimist')

const EncryptionService = require('./EncryptionService.class')

/**
 * Class responsible for managing the configuration.
 * @class ConfigService
 * @param {string} configFile - The config file
 * @return {void}
 */
class ConfigService {
  constructor(configFile) {
    this.encryptionService = EncryptionService.getInstance()

    this.configFile = configFile

    const baseDir = path.extname(this.configFile) ? path.parse(this.configFile).dir : this.configFile
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }

    this.historyQueryConfigFile = `${baseDir}/historyQuery.json`

    const defaultConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
    this.checkOrCreateConfigFile(this.configFile, defaultConfig)
    this.checkOrCreateConfigFile(this.historyQueryConfigFile, [])

    this.config = ConfigService.tryReadFile(this.configFile)
    this.modifiedConfig = JSON.parse(JSON.stringify(this.config))
    this.historyQueryConfig = ConfigService.tryReadFile(this.historyQueryConfigFile)
    this.historyQueryModifiedConfig = JSON.parse(JSON.stringify(this.historyQueryConfig))

    this.keyFolder = path.join(this.config.engine.caching.cacheFolder, 'keys')
  }

  /**
   * Get config file from console arguments
   * @returns {Object} - the config file and check argument
   */
  static getCommandLineArguments() {
    const args = minimist(process.argv.slice(2))
    const { config, check } = args
    return { configFile: path.resolve(config ?? './oibus.json'), check }
  }

  /**
   * Tries to read a file at a given path
   * @param {string} filePath - The location of the config file
   * @return {*} Content of the file
   */
  static tryReadFile(filePath) {
    if (!filePath.endsWith('.json')) {
      throw new Error('You must provide a json file for the configuration!')
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) // Get OIBus configuration file
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
   * Get HistoryQuery config.
   * @returns {object} - The config
   */
  getHistoryQueryConfig() {
    return this.historyQueryConfig
  }

  /**
   * Check if config file exists and create it if not
   * @param {string} filePath - The location of the config file
   * @return {boolean} - Whether it was successful or not
   */
  /* eslint-disable-next-line class-methods-use-this */
  checkOrCreateConfigFile(filePath, defaultConfig) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 4), 'utf8')
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
   * Get active HistoryQuery configuration.
   * @returns {object} - The active HistoryQuery configuration
   */
  getActiveHistoryQueryConfiguration() {
    return this.historyQueryConfig
  }

  /**
   * Update configuration
   * @param {object} config - The updated configuration
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
   * Update HistoryQuery configuration
   * @param {object} config - The updated HistoryQuery configuration
   * @returns {void}
   */
  updateHistoryQueryConfig(config) {
    this.historyQueryModifiedConfig = config
  }

  /**
   * Activate the configuration
   * @returns {void}
   */
  activateConfiguration() {
    ConfigService.backupConfigFile(this.configFile)
    ConfigService.saveConfig(this.configFile, this.modifiedConfig)
    this.config = JSON.parse(JSON.stringify(this.modifiedConfig))
  }

  /**
   * Activate the HistoryQuery configuration
   * @returns {void}
   */
  activateHistoryQueryConfiguration() {
    ConfigService.backupConfigFile(this.historyQueryConfigFile)
    ConfigService.saveConfig(this.historyQueryConfigFile, this.historyQueryModifiedConfig)
    this.historyQueryConfig = JSON.parse(JSON.stringify(this.historyQueryModifiedConfig))
  }

  /**
   * Get the location of the config file.
   * @returns {string} - The location of the config file
   */
  getConfigurationFileLocation() {
    return this.configFile
  }

  /**
   * Get the location of the HistoryQuery config file.
   * @returns {string} - The location of the HistoryQuery config file
   */
  getHistoryQueryConfigurationFileLocation() {
    return this.historyQueryConfigFile
  }

  /**
   * Save the new status for HistoryQuery with the given ID
   * @param {string} historyQueryId - The HistoryQuery ID to store the new status for
   * @param {string} status - The new status
   * @param {boolean} enabled - Enabled
   * @return {void}
   */
  saveStatusForHistoryQuery(historyQueryId, status, enabled = true) {
    const activeHistoryQueryConfig = this.historyQueryConfig.find((historyQueryConfig) => historyQueryConfig.id === historyQueryId)
    if (activeHistoryQueryConfig) {
      activeHistoryQueryConfig.status = status
      activeHistoryQueryConfig.enabled = enabled
      ConfigService.saveConfig(this.historyQueryConfigFile, this.historyQueryConfig)
      this.historyQueryModifiedConfig = JSON.parse(JSON.stringify(this.historyQueryConfig))
    }
  }
}

module.exports = ConfigService
