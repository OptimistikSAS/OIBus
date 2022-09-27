const path = require('node:path')
const fs = require('node:fs/promises')

const EncryptionService = require('./EncryptionService.class')

const {
  tryReadFile,
  checkOrCreateConfigFile,
  backupConfigFile,
  saveConfig,
} = require('./utils')

const KEYS_FOLDER = './keys'
const CERTS_FOLDER = './certs'

/**
 * Class responsible for managing the configuration.
 * @class ConfigService
 * @param {String} configFile - The config file
 * @return {void}
 */
class ConfigService {
  constructor(configFile, cacheFolder) {
    this.encryptionService = EncryptionService.getInstance()
    this.configFile = configFile
    this.cacheFolder = cacheFolder
  }

  async init() {
    const baseDir = path.extname(this.configFile) ? path.parse(this.configFile).dir : this.configFile

    try {
      await fs.stat(baseDir)
    } catch (err) {
      await fs.mkdir(baseDir, { recursive: true })
    }

    const defaultConfig = JSON.parse(await fs.readFile(`${__dirname}/../config/defaultConfig.json`, 'utf8'))
    await checkOrCreateConfigFile(this.configFile, defaultConfig)

    this.config = await tryReadFile(this.configFile)
    this.keyFolder = path.resolve(KEYS_FOLDER)
    this.certFolder = path.resolve(CERTS_FOLDER)
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
   * @param {Object} config - The updated configuration
   * @returns {Promise<void>} - The result promise
   */
  async updateConfig(config) {
    await this.encryptionService.encryptSecrets(config.engine)

    await config.north.reduce((promise, north) => promise.then(
      async () => this.encryptionService.encryptSecrets(north),
    ), Promise.resolve())
    await config.south.reduce((promise, south) => promise.then(
      async () => this.encryptionService.encryptSecrets(south),
    ), Promise.resolve())
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
}

module.exports = ConfigService
