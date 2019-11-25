const path = require('path')
const fs = require('fs')

const minimist = require('minimist')

const encryptionService = require('./encryption.service')
const Logger = require('../engine/Logger.class')

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
    this.logger = new Logger(this.constructor.name)

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
  static getConfigFile(logger) {
    const args = minimist(process.argv.slice(2))
    let { config } = args
    if (!config) {
      logger.error('No config file specified, example: --config ./config/config.json')
      config = './oibus.json'
    }
    return path.resolve(config)
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
   * @param {boolean} decryptSecrets - Whether to decrypt secret or not
   * @returns {Object} - The duplicated config
   */
  duplicateConfig(config, decryptSecrets = false) {
    try {
      const duplicateConfig = JSON.parse(JSON.stringify(config))
      if (decryptSecrets) {
        encryptionService.decryptSecrets(duplicateConfig.engine.proxies, this.keyFolder)
        encryptionService.decryptSecrets(duplicateConfig.north.applications, this.keyFolder)
        encryptionService.decryptSecrets(duplicateConfig.south.dataSources, this.keyFolder)
      }
      return duplicateConfig
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
   * Get active configuration.
   * @returns {object} - The active configuration
   */
  getModifiedConfiguration() {
    return this.modifiedConfig
  }

  /**
   * Check if the given application ID already exists
   * @param {string} applicationId - The application ID to check
   * @returns {object | undefined} - Whether the given application exists
   */
  hasNorth(applicationId) {
    return this.modifiedConfig.north.applications.find((application) => application.applicationId === applicationId)
  }

  /**
   * Add North application
   * @param {object} application - The new application to add
   * @returns {void}
   */
  addNorth(application) {
    encryptionService.encryptSecrets(application, this.keyFolder)
    this.modifiedConfig.north.applications.push(application)
  }

  /**
   * Update North application
   * @param {object} application - The updated application
   * @returns {void}
   */
  updateNorth(application) {
    const index = this.modifiedConfig.north.applications.findIndex(
      (element) => element.applicationId === application.applicationId,
    )
    if (index > -1) {
      encryptionService.encryptSecrets(application, this.keyFolder)
      this.modifiedConfig.north.applications[index] = application
    }
  }

  /**
   * Delete North application
   * @param {string} applicationId - The application to delete
   * @returns {void}
   */
  deleteNorth(applicationId) {
    this.modifiedConfig.north.applications = this.modifiedConfig.north.applications.filter(
      (application) => application.applicationId !== applicationId,
    )
  }

  /**
   * Check if the given data source ID already exists
   * @param {string} dataSourceId - The data source ID to check
   * @returns {object | undefined} - Whether the given data source exists
   */
  hasSouth(dataSourceId) {
    return this.modifiedConfig.south.dataSources.find((dataSource) => dataSource.dataSourceId === dataSourceId)
  }

  /**
   * Add South data source
   * @param {object} dataSource - The new data source to add
   * @returns {void}
   */
  addSouth(dataSource) {
    encryptionService.encryptSecrets(dataSource, this.keyFolder)
    this.modifiedConfig.south.dataSources.push(dataSource)
  }

  /**
   * Update South data source
   * @param {object} dataSource - The updated data source
   * @returns {void}
   */
  updateSouth(dataSource) {
    const index = this.modifiedConfig.south.dataSources.findIndex(
      (element) => element.dataSourceId === dataSource.dataSourceId,
    )
    if (index > -1) {
      encryptionService.encryptSecrets(dataSource, this.keyFolder)
      this.modifiedConfig.south.dataSources[index] = dataSource
    }
  }

  /**
   * Delete South data source
   * @param {string} dataSourceId - The data source to delete
   * @returns {void}
   */
  deleteSouth(dataSourceId) {
    this.modifiedConfig.south.dataSources = this.modifiedConfig.south.dataSources.filter(
      (dataSource) => dataSource.dataSourceId !== dataSourceId,
    )
  }

  /**
   * Update Engine
   * @param {object} config - The updated Engine
   * @returns {void}
   */
  updateConfig(config) {
    encryptionService.encryptSecrets(config.engine.proxies, this.keyFolder)
    config.north.applications.forEach((application) => {
      encryptionService.encryptSecrets(application, this.keyFolder)
    })
    config.south.dataSources.forEach((dataSource) => {
      encryptionService.encryptSecrets(dataSource, this.keyFolder)
    })
    this.modifiedConfig = config
  }

  /**
   * Get points for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @returns {object} - The points
   */
  getPointsForSouth(dataSourceId) {
    const dataSource = this.modifiedConfig.south.dataSources.find((elem) => elem.dataSourceId === dataSourceId)

    if (dataSource && dataSource.points) {
      return dataSource.points
    }

    return {}
  }

  /**
   * Check whether the given South already has a point with the given point ID.
   * @param {string} dataSourceId - The South to get the points for
   * @param {string} pointId - The point ID
   * @returns {boolean} - Whether the given South has a point with the given point ID
   */
  hasSouthPoint(dataSourceId, pointId) {
    const dataSource = this.modifiedConfig.south.dataSources.find((element) => element.dataSourceId === dataSourceId)

    if (dataSource && dataSource.points) {
      return dataSource.points.find((elem) => elem.pointId === pointId)
    }

    return false
  }

  /**
   * Add new point for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {object} point - The point to add
   * @returns {void}
   */
  addSouthPoint(dataSourceId, point) {
    const dataSource = this.modifiedConfig.south.dataSources.find((element) => element.dataSourceId === dataSourceId)
    if (dataSource) {
      if (!dataSource.points) {
        dataSource.points = []
      }
      dataSource.points.push(point)
    }
  }

  /**
   * Update point for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {string} pointId - The point to update
   * @param {object} point - The updated point
   * @returns {void}
   */
  updateSouthPoint(dataSourceId, pointId, point) {
    const dataSource = this.modifiedConfig.south.dataSources.find((element) => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      const index = dataSource.points.findIndex((element) => element.pointId === pointId)
      if (index > -1) {
        dataSource.points[index] = point
      }
    }
  }

  /**
   * Delete point from a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {string} pointId - The point ID to delete
   * @returns {void}
   */
  deleteSouthPoint(dataSourceId, pointId) {
    const dataSource = this.modifiedConfig.south.dataSources.find((element) => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      dataSource.points = dataSource.points.filter((point) => point.pointId !== pointId)
    }
  }

  /**
   * Delete all points from a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @returns {void}
   */
  deleteSouthPoints(dataSourceId) {
    const dataSource = this.modifiedConfig.south.dataSources.find((element) => element.dataSourceId === dataSourceId)
    if (dataSource && dataSource.points) {
      dataSource.points = []
    }
  }

  /**
   * Set points for a given South.
   * @param {string} dataSourceId - The South to get the points for
   * @param {object[]} points - The points to set
   * @returns {void}
   */
  setSouthPoints(dataSourceId, points) {
    const dataSource = this.modifiedConfig.south.dataSources.find((element) => element.dataSourceId === dataSourceId)
    if (dataSource) {
      dataSource.points = points
    }
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
   * Returns all available scan modes
   * @returns {Array} - Array of available scan modes
   */
  getScanModes() {
    return this.config.engine.scanModes
  }

  /**
   * Reset configuration
   * @returns {void}
   */
  resetConfiguration() {
    this.modifiedConfig = this.duplicateConfig(this.config)
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
