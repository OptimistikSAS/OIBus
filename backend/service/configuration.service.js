import path from 'node:path'
import fs from 'node:fs/promises'

import EncryptionService from './encryption.service.js'
import { filesExists } from './utils.js'
import defaultConfig from '../config/default-config.json'

const KEYS_FOLDER = './keys'
const CERTS_FOLDER = './certs'

/**
 * Class responsible for managing the configuration.
 * @class ConfigurationService
 */
export default class ConfigurationService {
  /**
   * Constructor for ConfigService
   * @constructor
   * @param {String} configFilePath - The config file
   * @param {String} cacheFolder - The cache folder to use
   * @return {void}
   */
  constructor(configFilePath, cacheFolder) {
    this.encryptionService = EncryptionService.getInstance()
    this.configFilePath = path.resolve(configFilePath)
    this.cacheFolder = path.resolve(cacheFolder)

    this.keyFolder = path.resolve(KEYS_FOLDER)
    this.certFolder = path.resolve(CERTS_FOLDER)

    this.config = null
    this.modifiedConfig = null
  }

  /**
   * Init the config service by creating folders and initiating default config if necessary
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    let config
    if (await filesExists(this.configFilePath)) {
      config = JSON.parse(await fs.readFile(this.configFilePath, { encoding: 'utf8' }))
    } else {
      config = defaultConfig
    }

    const previousConfig = JSON.stringify(config)
    // When a specific config is used with unencrypted secrets, it allows to encrypt credentials and update the config.
    // In this case, no backup is used to avoid plain text secrets
    // This can happen after a fresh installation with a config file edited by the user or an installation script
    await this.updateConfig(config)

    if (JSON.stringify(this.modifiedConfig) !== previousConfig) {
      await this.activateConfiguration(false)
    } else {
      this.config = this.modifiedConfig
    }
  }

  /**
   * Return the engine, south and north config
   * @returns {Object} - The configs
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
   * @returns {Object} - The active configuration
   */
  getActiveConfiguration() {
    return this.config
  }

  /**
   * Update configuration and encrypt password and secrets
   * @param {Object} newConfig - The updated configuration
   * @returns {Promise<void>} - The result promise
   */
  async updateConfig(newConfig) {
    await this.encryptionService.encryptSecrets(newConfig.engine)

    await newConfig.north.reduce((promise, north) => promise.then(
      async () => this.encryptionService.encryptSecrets(north),
    ), Promise.resolve())
    await newConfig.south.reduce((promise, south) => promise.then(
      async () => this.encryptionService.encryptSecrets(south),
    ), Promise.resolve())
    this.modifiedConfig = newConfig
  }

  /**
   * Activate the configuration, i.e. saving a new config file
   * @param {Boolean} backup - Should save a backup file or not
   * @returns {void}
   */
  async activateConfiguration(backup = true) {
    if (backup) {
      const timestamp = new Date().getTime()
      const backupFilename = `${path.parse(this.configFilePath).name}-${timestamp}${path.parse(this.configFilePath).ext}`
      const backupPath = path.resolve(path.parse(this.configFilePath).dir, backupFilename)

      await fs.copyFile(this.configFilePath, backupPath)
    }
    await fs.writeFile(this.configFilePath, JSON.stringify(this.modifiedConfig, null, 4), 'utf8')
    await this.removeOrphanCacheFolders(this.modifiedConfig)
    this.config = JSON.parse(JSON.stringify(this.modifiedConfig))
  }

  async removeOrphanCacheFolders(newConfig) {
    const northIdList = newConfig.north.map((north) => north.id)
    const southIdList = newConfig.south.map((south) => south.id)
    const idList = [...northIdList, ...southIdList]

    const dataStreamFolderPath = path.resolve(this.cacheFolder, 'data-stream')
    const pathExists = await filesExists(dataStreamFolderPath)
    if (pathExists) {
      const folders = await fs.readdir(dataStreamFolderPath)
      await Promise.allSettled(folders.map(async (folder) => {
        const uid = folder.replace('north-', '').replace('south-', '')
        if (!idList.includes(uid)) {
          await fs.rm(path.resolve(dataStreamFolderPath, folder), { recursive: true })
        }
      }))
    }
  }
}
