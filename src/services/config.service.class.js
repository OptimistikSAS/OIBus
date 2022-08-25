const path = require('node:path')
const fs = require('node:fs/promises')

const EncryptionService = require('./EncryptionService.class')

const {
  tryReadFile,
  checkOrCreateConfigFile,
  backupConfigFile,
  saveConfig,
} = require('./utils')

/**
 * Class responsible for managing the configuration.
 * @class ConfigService
 * @param {String} configFile - The config file
 * @return {void}
 */
class ConfigService {
  constructor(configFile) {
    this.encryptionService = EncryptionService.getInstance()
    this.configFile = configFile
  }

  async init() {
    const baseDir = path.extname(this.configFile) ? path.parse(this.configFile).dir : this.configFile
    this.historyQueryConfigFile = `${baseDir}/historyQuery.db`

    try {
      await fs.stat(baseDir)
    } catch (err) {
      await fs.mkdir(baseDir, { recursive: true })
    }

    const defaultConfig = JSON.parse(await fs.readFile(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
    await checkOrCreateConfigFile(this.configFile, defaultConfig)

    this.config = await tryReadFile(this.configFile)
    this.keyFolder = path.join(this.config.engine.caching.cacheFolder, 'keys')
    this.certFolder = path.join(this.config.engine.caching.cacheFolder, 'certs')
    this.modifiedConfig = JSON.parse(JSON.stringify(this.config))
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
   * Get active configuration.
   * @returns {object} - The active configuration
   */
  getActiveConfiguration() {
    return this.config
  }

  /**
   * Update configuration
   * @param {object} config - The updated configuration
   * @returns {void}
   */
  updateConfig(config) {
    this.encryptionService.encryptSecrets(config.engine)
    config.north.applications.forEach((north) => {
      this.encryptionService.encryptSecrets(north)
    })
    config.south.dataSources.forEach((south) => {
      this.encryptionService.encryptSecrets(south)
    })
    this.modifiedConfig = config
  }

  /**
   * Activate the configuration
   * @returns {void}
   */
  async activateConfiguration() {
    await backupConfigFile(this.configFile)
    await saveConfig(this.configFile, this.modifiedConfig)
    this.config = JSON.parse(JSON.stringify(this.modifiedConfig))
  }

  /**
   * Get the location of the config file.
   * @returns {String} - The location of the config file
   */
  getConfigurationFileLocation() {
    return this.configFile
  }

  /**
   * Get the location of the HistoryQuery config file.
   * @returns {String} - The location of the HistoryQuery config file
   */
  getHistoryQueryConfigurationFileLocation() {
    return this.historyQueryConfigFile
  }
}

module.exports = ConfigService
