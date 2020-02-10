const fs = require('fs')
const path = require('path')

const databaseService = require('../services/database.service')
const Queue = require('../services/queue.class')
const Logger = require('./Logger.class')

/**
 * Local cache implementation to group events and store them when the communication if North is down.
 */
class Cache {
  /**
   * Constructor for Cache
   * The Engine parameters is used for the following parameters
   * cacheFolder: Value mode only: will contain all sqllite databases used to cache values
   * archiveMode: File mode only: decide if the file is deleted or archived after being sent to the North.
   * archiveFolder: in 'archive' mode, specifies where the file is archived.
   * @constructor
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(engine) {
    this.engine = engine
    this.logger = new Logger('Cache')
    // get parameters for the cache
    const { engineConfig } = engine.configService.getConfig()
    const { cacheFolder, archiveFolder, archiveMode } = engineConfig.caching
    this.archiveMode = archiveMode
    // Create cache folder if not exists
    this.cacheFolder = path.resolve(cacheFolder)
    if (!fs.existsSync(this.cacheFolder)) {
      this.logger.info(`creating cache folder in ${this.cacheFolder}`)
      fs.mkdirSync(this.cacheFolder, { recursive: true })
    }
    // Create archive folder if not exists
    this.archiveFolder = path.resolve(archiveFolder)
    if (!fs.existsSync(this.archiveFolder)) {
      this.logger.info(`creating archive folder in ${this.archiveFolder}`)
      fs.mkdirSync(this.archiveFolder, { recursive: true })
    }
    // will contains the list of North apis
    this.apis = {}
    // Queuing
    this.sendInProgress = {}
    this.resendImmediately = {}
    // manage a queue for concurrent request to write to SQL
    this.queue = new Queue()
    // Cache stats
    this.cacheStats = {}
  }

  /**
   * Initialize an active North.
   * @param {Object} activeApi - The North to initialize
   * @returns {Promise<void>} - The result
   */
  async initializeApi(activeApi) {
    const api = {
      applicationId: activeApi.application.applicationId,
      config: activeApi.application.caching,
      canHandleValues: activeApi.canHandleValues,
      canHandleFiles: activeApi.canHandleFiles,
      subscribedTo: activeApi.application.subscribedTo,
    }
    // only initialize the db if the api can handle values
    if (api.canHandleValues) {
      this.logger.debug(`use db: ${this.cacheFolder}/${api.applicationId}.db`)
      api.database = await databaseService.createValuesDatabase(`${this.cacheFolder}/${api.applicationId}.db`)
      this.logger.debug(`db count: ${await databaseService.getCount(api.database)}`)
    }
    this.apis[api.applicationId] = api
    if (api && api.config && api.config.sendInterval) {
      this.resetTimeout(api, api.config.sendInterval)
    } else {
      this.logger.warning(`api: ${api.applicationId} has no sendInterval - OK if AliveSignal`)
    }
  }

  /**
   * Initialize the cache by creating a database for every North application.
   * also initializes an internal object for North applications
   * @param {object} activeApis - The active North applications
   * @return {void}
   */
  async initialize(activeApis) {
    this.logger.debug(`use db: ${this.cacheFolder}/fileCache.db`)
    this.filesDatabase = await databaseService.createFilesDatabase(`${this.cacheFolder}/fileCache.db`)
    this.logger.debug(`db count: ${await databaseService.getCount(this.filesDatabase)}`)
    // initialize the internal object apis with the list of north apis
    const actions = Object.values(activeApis).map((activeApi) => this.initializeApi(activeApi))
    await Promise.all(actions)
  }

  /**
   * Check whether a North is subscribed to a South. if subscribedTo is not defined
   * or an empty array, the subscription is true.
   * @param {string} dataSourceId - The South generating the value
   * @param {string[]} subscribedTo - The list of Souths the North is subscribed to
   * @returns {boolean} - The North is subscribed to the given South
   */
  static isSubscribed(dataSourceId, subscribedTo) {
    if (!Array.isArray(subscribedTo) || subscribedTo.length === 0) return true
    return subscribedTo.includes(dataSourceId)
  }

  /**
   * Cache a new Value from the South for a given North
   * It will store the value in every database.
   * to every North application (used for alarm values for example)
   * @param {Object} api - The North to cache the Value for
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - values
   * @return {object} the api object or null if api should do nothing.
   */
  async cacheValuesForApi(api, dataSourceId, values) {
    const { applicationId, database, config, canHandleValues, subscribedTo } = api
    // save the value in the North's queue if it is subscribed to the dataSource
    if (canHandleValues && Cache.isSubscribed(dataSourceId, subscribedTo)) {
      // Update stats for api
      this.cacheStats[applicationId] = (this.cacheStats[applicationId] || 0) + values.length

      // Queue saving values.
      this.queue.add(databaseService.saveValues, database, dataSourceId, values)

      // if the group size is over the groupCount => we immediately send the cache
      // to the North even if the timeout is not finished.
      const count = await databaseService.getCount(database)
      if (count >= config.groupCount) {
        this.logger.silly(`groupCount reached: ${count}>=${config.groupCount}`)
        return api
      }
    }
    return null
  }

  /**
   * Cache a new Value from the South
   * It will store the value in every database.
   * to every North application (used for alarm values for example)
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - The new value
   * @return {void}
   */
  async cacheValues(dataSourceId, values) {
    try {
      // Update stats for dataSourceId
      this.cacheStats[dataSourceId] = (this.cacheStats[dataSourceId] || 0) + values.length

      // Cache values
      const actions = Object.values(this.apis).map((api) => this.cacheValuesForApi(api, dataSourceId, values))
      const apisToActivate = await Promise.all(actions)
      apisToActivate.forEach((apiToActivate) => {
        if (apiToActivate) {
          this.sendCallback(apiToActivate)
        }
      })
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Cache the new raw file for a given North.
   * @param {object} api - The North to cache the file for
   * @param {string} dataSourceId - The South generating the file
   * @param {String} cachePath - The path of the raw file
   * @param {number} timestamp - The timestamp the file was received
   * @return {object} the api object or null if api should do nothing.
   */
  async cacheFileForApi(api, dataSourceId, cachePath, timestamp) {
    const { applicationId, canHandleFiles, subscribedTo } = api
    if (canHandleFiles && Cache.isSubscribed(dataSourceId, subscribedTo)) {
      // Update stats for api
      this.cacheStats[applicationId] = (this.cacheStats[applicationId] || 0) + 1

      // Cache file
      this.logger.debug(`cacheFileForApi() ${cachePath} for api: ${applicationId}`)
      await databaseService.saveFile(this.filesDatabase, timestamp, applicationId, cachePath)
      return api
    }
    return null
  }

  /**
   * Cache the new raw file.
   * @param {string} dataSourceId - The South generating the file
   * @param {String} filePath - The path of the raw file
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  async cacheFile(dataSourceId, filePath, preserveFiles) {
    // Update stats for dataSourceId
    this.cacheStats[dataSourceId] = (this.cacheStats[dataSourceId] || 0) + 1

    // Cache files
    this.logger.debug(`cacheFile() from ${dataSourceId} with ${filePath}, preserveFiles:${preserveFiles}`)
    const timestamp = new Date().getTime()
    const cacheFilename = `${path.parse(filePath).name}-${timestamp}${path.parse(filePath).ext}`
    const cachePath = path.join(this.cacheFolder, cacheFilename)

    try {
      // Move or copy the file into the cache folder
      await this.transferFile(filePath, cachePath, preserveFiles)

      // Cache the file for every subscribed North
      const actions = Object.values(this.apis).map((api) => this.cacheFileForApi(api, dataSourceId, cachePath, timestamp))
      const apisToActivate = await Promise.all(actions)
      // Activate sending
      apisToActivate.forEach((apiToActivate) => {
        if (apiToActivate) {
          this.sendCallback(apiToActivate)
        }
      })
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Transfer the file into the cache folder.
   *
   * @param {string} filePath - The file path
   * @param {string} cachePath - The cache path
   * @param {boolean} preserveFiles - Whether to preserve the file
   * @returns {Promise<*>} - The result promise
   */
  transferFile(filePath, cachePath, preserveFiles) {
    return new Promise((resolve, reject) => {
      try {
        if (preserveFiles) {
          this.logger.silly(`transferFile() - preserveFiles true so copy to ${cachePath}`)
          fs.copyFile(filePath, cachePath, (copyError) => {
            if (copyError) throw copyError
            resolve()
          })
        } else {
          this.logger.silly(`transferFile() -  preserveFiles false so rename to ${cachePath}`)
          fs.rename(filePath, cachePath, (renameError) => {
            if (renameError) {
              // In case of cross-device link error we copy+delete instead
              if (renameError.code !== 'EXDEV') throw renameError
              this.logger.debug('Cross-device link error during rename, copy+paste instead')
              fs.copyFile(filePath, cachePath, (copyError) => {
                if (copyError) throw copyError
                fs.unlink(filePath, (unlinkError) => {
                  // log error but does not throw so we try sending the file to S3
                  if (unlinkError) this.logger.error(unlinkError)
                })
                resolve()
              })
            } else {
              resolve()
            }
          })
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Callback function used by the timer to send the values to the given North application.
   * @param {object} api - The application
   * @return {void}
   */
  async sendCallback(api) {
    const { applicationId, canHandleValues, canHandleFiles, config } = api
    let success = true

    this.logger.silly(`sendCallback ${applicationId} with sendInProgress ${!!this.sendInProgress[applicationId]}`)

    if (!this.sendInProgress[applicationId]) {
      this.sendInProgress[applicationId] = true
      this.resendImmediately[applicationId] = false

      if (canHandleValues) {
        success = await this.sendCallbackForValues(api)
      }

      if (canHandleFiles) {
        success = await this.sendCallbackForFiles(api)
      }

      const successTimeout = this.resendImmediately[applicationId] ? 0 : config.sendInterval
      const timeout = success ? successTimeout : config.retryInterval
      this.resetTimeout(api, timeout)

      this.sendInProgress[applicationId] = false
    } else {
      this.resendImmediately[applicationId] = true
    }
  }

  /**
   * handle the values for the callback
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async sendCallbackForValues(application) {
    this.logger.silly(`Cache sendCallbackForValues() for ${application.applicationId}`)
    const { applicationId, database, config } = application

    try {
      const values = await databaseService.getValuesToSend(database, config.maxSendCount)

      if (values) {
        this.logger.silly(`Cache:sendCallbackForValues() got ${values.length} values to send to ${application.applicationId}`)
        const success = await this.engine.handleValuesFromCache(applicationId, values)
        this.logger.silly(`Cache:handleValuesFromCache, success: ${success} AppId: ${application.applicationId}`)
        if (success) {
          const removed = await databaseService.removeSentValues(database, values)
          this.logger.silly(`Cache:removeSentValues, removed: ${removed} AppId: ${application.applicationId}`)
          if (removed !== values.length) {
            this.logger.debug(`Cache for ${applicationId} can't be deleted: ${removed}/${values.length}`)
          }
        }
      }
    } catch (error) {
      this.logger.error(error)
      return false
    }
    return true
  }

  /**
   * Handle files resending.
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async sendCallbackForFiles(application) {
    const { applicationId } = application
    this.logger.silly(`Cache sendCallbackForFiles() for ${applicationId}`)

    try {
      const filePath = await databaseService.getFileToSend(this.filesDatabase, applicationId)
      this.logger.silly(`sendCallbackForFiles() filePath:${filePath}`)

      if (filePath === null) {
        this.logger.silly('sendCallbackForFiles(): no file to send')
        return true
      }

      if (!fs.existsSync(filePath)) {
        // file in cache does not exist on filesystem
        await databaseService.deleteSentFile(this.filesDatabase, applicationId, filePath)
        this.logger.error(new Error(`File ${filePath} doesn't exist. Removing it from database.`))
        return false
      }
      this.logger.silly(`sendCallbackForFiles() call Engine sendFile() ${applicationId} and ${filePath}`)
      const success = await this.engine.sendFile(applicationId, filePath)
      if (success) {
        this.logger.silly(`sendCallbackForFiles() deleteSentFile for ${applicationId} and ${filePath}`)
        await databaseService.deleteSentFile(this.filesDatabase, applicationId, filePath)
        await this.handleSentFile(filePath)
      }
      return success
    } catch (error) {
      this.logger.error(error)
      return false
    }
  }

  /**
   * Remove file if it was sent to all North.
   * @param {string} filePath - The file
   * @return {void}
   */
  async handleSentFile(filePath) {
    this.logger.silly(`handleSentFile() for ${filePath}`)
    const count = await databaseService.getFileCount(this.filesDatabase, filePath)
    if (count === 0) {
      const archivedFilename = path.basename(filePath)
      const archivePath = path.join(this.archiveFolder, archivedFilename)

      switch (this.archiveMode) {
        case 'delete':
          // Delete original file
          fs.unlink(filePath, (unlinkError) => {
            if (unlinkError) {
              this.logger.error(unlinkError)
            } else {
              this.logger.info(`File ${filePath} deleted`)
            }
          })
          break
        case 'archive':
          // Create archive folder if it doesn't exist
          if (!fs.existsSync(this.archiveFolder)) {
            fs.mkdirSync(this.archiveFolder, { recursive: true })
          }

          // Move original file into the archive folder
          fs.rename(filePath, archivePath, (renameError) => {
            if (renameError) {
              this.logger.error(renameError)
            } else {
              this.logger.info(`File ${filePath} moved to ${archivePath}`)
            }
          })
          break
        default:
          this.logger.error(`unknown Archive Mode: ${this.archiveMode}`)
      }
    }
  }

  /**
   * Reset application timer.
   * @param {object} application - The application
   * @param {number} timeout - The timeout interval
   * @return {void}
   */
  resetTimeout(application, timeout) {
    if (application.timeout) {
      clearTimeout(application.timeout)
    }
    application.timeout = setTimeout(this.sendCallback.bind(this, application), timeout)
  }

  /**
   * Generate cache stat for APIs
   * @param {string[]} apiNames - The North/South list
   * @param {number[]} totalCounts - The total count list
   * @param {number[]} cacheSizes - The cache size list
   * @returns {*} - The stats
   */
  /* eslint-disable-next-line class-methods-use-this */
  generateApiCacheStat(apiNames, totalCounts, cacheSizes, mode) {
    return apiNames.map((api, i) => ({
      name: `${api.applicationId} (${mode})`,
      count: totalCounts[i] || 0,
      cache: cacheSizes[i] || 0,
    }))
  }

  /**
   * Get cache stats for APIs
   * @returns {object} - Cache stats
   */
  async getCacheStatsForApis() {
    // Get points APIs stats
    const pointApis = Object.values(this.apis).filter((api) => api.canHandleValues)
    const valuesTotalCounts = pointApis.map((api) => this.cacheStats[api.applicationId])
    const valuesCacheSizeActions = pointApis.map((api) => databaseService.getCount(api.database))
    const valuesCacheSizes = await Promise.all(valuesCacheSizeActions)
    const pointApisStats = this.generateApiCacheStat(pointApis, valuesTotalCounts, valuesCacheSizes, 'points')

    // Get file APIs stats
    const fileApis = Object.values(this.apis).filter((api) => api.canHandleFiles)
    const filesTotalCounts = fileApis.map((api) => this.cacheStats[api.applicationId])
    const filesCacheSizeActions = fileApis.map((api) => databaseService.getFileCountForApi(this.filesDatabase, api.applicationId))
    const filesCacheSizes = await Promise.all(filesCacheSizeActions)
    const fileApisStats = this.generateApiCacheStat(fileApis, filesTotalCounts, filesCacheSizes, 'files')

    // Merge results
    return [...pointApisStats, ...fileApisStats]
  }

  /**
   * Get cache stats for Protocols
   * @returns {object} - Cache stats
   */
  async getCacheStatsForProtocols() {
    const protocols = this.engine.getActiveProtocols()
    return protocols.map((protocol) => ({
      name: protocol,
      count: this.cacheStats[protocol] || 0,
    }))
  }
}

module.exports = Cache
