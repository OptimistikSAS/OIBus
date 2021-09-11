const fs = require('fs')
const path = require('path')

const databaseService = require('../services/database.service')
const Queue = require('../services/queue.class')
const Logger = require('./Logger.class')
const ApiHandler = require('../north/ApiHandler.class')

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000 // one hour

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
    this.logger = Logger.getDefaultLogger()
    // get parameters for the cache
    const { engineConfig } = engine.configService.getConfig()
    const { cacheFolder, archive } = engineConfig.caching
    this.archiveMode = archive.enabled
    this.retentionDuration = (archive.retentionDuration) * 3600000
    // Create cache folder if not exists
    this.cacheFolder = path.resolve(cacheFolder)
    if (!fs.existsSync(this.cacheFolder)) {
      this.logger.info(`creating cache folder in ${this.cacheFolder}`)
      fs.mkdirSync(this.cacheFolder, { recursive: true })
    }
    if (this.archiveMode) {
      // Create archive folder if not exists
      this.archiveFolder = path.resolve(archive.archiveFolder)
      if (!fs.existsSync(this.archiveFolder)) {
        this.logger.info(`creating archive folder in ${this.archiveFolder}`)
        fs.mkdirSync(this.archiveFolder, { recursive: true })
      }
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
    this.logger.debug(`Cache initialized with cacheFolder:${this.archiveFolder} and archiveFolder: ${this.archiveFolder}`)
    // Errored files/values database path
    this.filesErrorDatabasePath = `${this.cacheFolder}/fileCache-error.db`
    this.valuesErrorDatabasePath = `${this.cacheFolder}/valueCache-error.db`

    this.archiveTimeout = null
    // refresh the archiveFolder at the beginning only if retentionDuration is different than 0
    if (this.archiveMode && this.retentionDuration > 0) {
      this.refreshArchiveFolder()
    }
  }

  /**
   * Initialize an active North.
   * @param {Object} activeApi - The North to initialize
   * @returns {Promise<void>} - The result
   */
  async initializeApi(activeApi) {
    const api = {
      id: activeApi.application.id,
      name: activeApi.application.name,
      config: activeApi.application.caching,
      canHandleValues: activeApi.canHandleValues,
      canHandleFiles: activeApi.canHandleFiles,
      subscribedTo: activeApi.application.subscribedTo,
    }
    // only initialize the db if the api can handle values
    if (api.canHandleValues) {
      this.logger.debug(`use db: ${this.cacheFolder}/${api.id}.db for ${api.name}`)
      api.database = await databaseService.createValuesDatabase(`${this.cacheFolder}/${api.id}.db`, {})
      this.logger.debug(`db count: ${await databaseService.getCount(api.database)}`)
    }
    this.apis[api.id] = api
    if (api && api.config && api.config.sendInterval) {
      this.resetTimeout(api, api.config.sendInterval)
    } else {
      this.logger.warning(`api: ${api.name} has no sendInterval`)
    }
  }

  /**
   * Initialize the cache by creating a database for every North application.
   * also initializes an internal object for North applications
   * @param {object} activeApis - The active North applications
   * @return {void}
   */
  async initializeApis(activeApis) {
    // initialize the internal object apis with the list of north apis
    const actions = Object.values(activeApis).map((activeApi) => this.initializeApi(activeApi))
    await Promise.all(actions)
  }

  /**
   * Initialize the cache by creating a database files and value errors.
   * @return {void}
   */
  async initialize() {
    this.logger.debug(`Use file dbs: ${this.cacheFolder}/fileCache.db and ${this.filesErrorDatabasePath}`)
    this.filesDatabase = await databaseService.createFilesDatabase(`${this.cacheFolder}/fileCache.db`)
    this.filesErrorDatabase = await databaseService.createFilesDatabase(this.filesErrorDatabasePath)
    this.valuesErrorDatabase = await databaseService.createValueErrorsDatabase(this.valuesErrorDatabasePath)
    this.logger.debug(`Files db count: ${await databaseService.getCount(this.filesDatabase)}`)
    this.logger.debug(`Files error db count: ${await databaseService.getCount(this.filesErrorDatabase)}`)
    this.logger.debug(`Values error db count: ${await databaseService.getCount(this.valuesErrorDatabase)}`)
  }

  /**
   * Check whether a North is subscribed to a South. if subscribedTo is not defined
   * or an empty array, the subscription is true.
   * @param {string} id - The data source id
   * @param {string[]} subscribedTo - The list of Souths the North is subscribed to
   * @returns {boolean} - The North is subscribed to the given South
   */
  static isSubscribed(id, subscribedTo) {
    if (!Array.isArray(subscribedTo) || subscribedTo.length === 0) return true
    return subscribedTo.includes(id)
  }

  /**
   * Cache a new Value from the South for a given North
   * It will store the value in every database.
   * to every North application
   * @param {Object} api - The North to cache the Value for
   * @param {string} id - The data source id
   * @param {object} values - values
   * @return {object} the api object or null if api should do nothing.
   */
  async cacheValuesForApi(api, id, values) {
    const { id: applicationId, database, config, canHandleValues, subscribedTo } = api
    // save the value in the North's queue if it is subscribed to the dataSource
    if (canHandleValues && Cache.isSubscribed(id, subscribedTo)) {
      // Update stats for api
      this.cacheStats[applicationId] = (this.cacheStats[applicationId] || 0) + values.length

      // Queue saving values.
      this.queue.add(databaseService.saveValues, database, this.engine.activeProtocols[id]?.dataSource.name || id, values)

      // if the group size is over the groupCount => we immediately send the cache
      // to the North even if the timeout is not finished.
      const count = await databaseService.getCount(database)
      if (count >= config.groupCount) {
        this.logger.silly(`groupCount reached: ${count}>=${config.groupCount}`)
        return api
      }
    } else {
      // eslint-disable-next-line max-len
      this.logger.silly(`Application "${this.engine.activeApis[applicationId]?.application.name || applicationId}" is not subscribed to datasource "${this.engine.activeProtocols[id]?.dataSource.name || id}"`)
    }
    return null
  }

  /**
   * Cache a new Value from the South
   * It will store the value in every database.
   * to every North application (used for alarm values for example)
   * @param {string} id - The data source id
   * @param {object} values - The new value
   * @return {void}
   */
  async cacheValues(id, values) {
    try {
      // Update stats for datasource id
      this.cacheStats[id] = (this.cacheStats[id] || 0) + values.length

      // Cache values
      const actions = Object.values(this.apis).map((api) => this.cacheValuesForApi(api, id, values))
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
   * @param {string} id - The data source id
   * @param {String} cachePath - The path of the raw file
   * @param {number} timestamp - The timestamp the file was received
   * @return {object} the api object or null if api should do nothing.
   */
  async cacheFileForApi(api, id, cachePath, timestamp) {
    const { name: applicationName, id: applicationId, canHandleFiles, subscribedTo } = api
    if (canHandleFiles && Cache.isSubscribed(id, subscribedTo)) {
      // Update stats for api
      this.cacheStats[applicationName] = (this.cacheStats[applicationName] || 0) + 1

      // Cache file
      this.logger.debug(`cacheFileForApi() ${cachePath} for api: ${applicationName}`)
      await databaseService.saveFile(this.filesDatabase, timestamp, applicationId, cachePath)
      return api
    }
    this.logger.silly(`datasource "${this.engine.activeProtocols[id]?.dataSource.name || id}" is not subscribed to application "${applicationName}"`)
    return null
  }

  /**
   * Cache the new raw file.
   * @param {string} id - The data source id
   * @param {String} filePath - The path of the raw file
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  async cacheFile(id, filePath, preserveFiles) {
    // Update stats for datasource name
    this.cacheStats[id] = (this.cacheStats[id] || 0) + 1

    // Cache files
    this.logger.debug(`cacheFile(${filePath}) from "${this.engine.activeProtocols[id]?.dataSource.name || id}", preserveFiles:${preserveFiles}`)
    const timestamp = new Date().getTime()
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath)
    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`
    const cachePath = path.join(this.cacheFolder, cacheFilename)

    try {
      // Move or copy the file into the cache folder
      await this.transferFile(filePath, cachePath, preserveFiles)

      // Cache the file for every subscribed North
      const actions = Object.values(this.apis).map((api) => this.cacheFileForApi(api, id, cachePath, timestamp))
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
      this.logger.debug(`transferFile(${filePath}) - preserveFiles:${preserveFiles}, cachePath:${cachePath}`)
      try {
        if (preserveFiles) {
          fs.copyFile(filePath, cachePath, (copyError) => {
            if (copyError) throw copyError
            resolve()
          })
        } else {
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
              })
            }
            resolve()
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
    const { name, canHandleValues, canHandleFiles, config } = api
    let status = ApiHandler.STATUS.SUCCESS

    this.logger.silly(`sendCallback ${name}, sendInProgress ${!!this.sendInProgress[name]}`)

    if (!this.sendInProgress[name]) {
      this.sendInProgress[name] = true
      this.resendImmediately[name] = false

      if (canHandleValues) {
        status = await this.sendCallbackForValues(api)
      }

      if (canHandleFiles) {
        status = await this.sendCallbackForFiles(api)
      }

      const successTimeout = this.resendImmediately[name] ? 0 : config.sendInterval
      const timeout = (status === ApiHandler.STATUS.SUCCESS) ? successTimeout : config.retryInterval
      this.resetTimeout(api, timeout)

      this.sendInProgress[name] = false
    } else {
      this.resendImmediately[name] = true
    }
  }

  /**
   * handle the values for the callback
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async sendCallbackForValues(application) {
    this.logger.silly(`Cache sendCallbackForValues() for ${application.name}`)
    const { id, name, database, config } = application

    try {
      const values = await databaseService.getValuesToSend(database, config.maxSendCount)
      let removed

      if (values.length) {
        this.logger.silly(`Cache:sendCallbackForValues() got ${values.length} values to send to ${application.name}`)
        const successCountStatus = await this.engine.handleValuesFromCache(id, values)
        this.logger.silly(`Cache:handleValuesFromCache, successCountStatus: ${successCountStatus}, Application: ${application.name}`)
        // If there was a logic error
        if (successCountStatus === ApiHandler.STATUS.LOGIC_ERROR) {
          // Add errored values into error table
          this.logger.silly(`Cache:addErroredValues, add ${values.length} values to error database for ${name}`)
          await databaseService.saveErroredValues(this.valuesErrorDatabase, id, values)

          // Remove them from the cache table
          removed = await databaseService.removeSentValues(database, values)
          this.logger.silly(`Cache:removeSentValues, removed: ${removed} AppId: ${application.name}`)
          if (removed !== values.length) {
            this.logger.debug(`Cache for ${name} can't be deleted: ${removed}/${values.length}`)
          }
        }
        // If some values were successfully sent
        if (successCountStatus > 0) {
          const valuesSent = values.slice(0, successCountStatus)
          removed = await databaseService.removeSentValues(database, valuesSent)
          this.logger.silly(`Cache:removeSentValues, removed: ${removed} AppId: ${application.name}`)
          if (removed !== valuesSent.length) {
            this.logger.debug(`Cache for ${name} can't be deleted: ${removed}/${valuesSent.length}`)
          }
        }
      } else {
        this.logger.silly(`no values in the db for ${name}`)
      }
      return ApiHandler.STATUS.SUCCESS
    } catch (error) {
      this.logger.error(error)
      return ApiHandler.STATUS.COMMUNICATION_ERROR
    }
  }

  /**
   * Handle files resending.
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async sendCallbackForFiles(application) {
    const { id, name } = application
    this.logger.silly(`sendCallbackForFiles() for ${name}`)

    try {
      const fileToSend = await databaseService.getFileToSend(this.filesDatabase, id)

      if (fileToSend === null) {
        this.logger.silly('sendCallbackForFiles(): no file to send')
        return ApiHandler.STATUS.SUCCESS
      }

      this.logger.silly(`sendCallbackForFiles() file:${fileToSend.path}`)

      if (!fs.existsSync(fileToSend.path)) {
        // file in cache does not exist on filesystem
        await databaseService.deleteSentFile(this.filesDatabase, id, fileToSend.path)
        this.logger.error(new Error(`${fileToSend.path} not found! Removing it from db.`))
        return ApiHandler.STATUS.SUCCESS
      }
      this.logger.silly(`sendCallbackForFiles(${fileToSend.path}) call sendFile() ${name}`)
      const status = await this.engine.sendFile(id, fileToSend.path)
      switch (status) {
        case ApiHandler.STATUS.SUCCESS:
          this.logger.silly(`sendCallbackForFiles(${fileToSend.path}) deleteSentFile for ${name}`)
          await databaseService.deleteSentFile(this.filesDatabase, id, fileToSend.path)
          await this.handleSentFile(fileToSend.path)
          break
        case ApiHandler.STATUS.LOGIC_ERROR:
          this.logger.error(`sendCallbackForFiles(${fileToSend.path}) move to error database for ${name}`)
          await databaseService.saveFile(this.filesErrorDatabase, fileToSend.timestamp, id, fileToSend.path)

          this.logger.silly(`sendCallbackForFiles(${fileToSend.path}) deleteSentFile for ${name}`)
          await databaseService.deleteSentFile(this.filesDatabase, id, fileToSend.path)
          break
        default:
          break
      }
      return status
    } catch (error) {
      this.logger.error(error)
      return ApiHandler.STATUS.COMMUNICATION_ERROR
    }
  }

  /**
   * Remove file if it was sent to all North.
   * @param {string} filePath - The file
   * @return {void}
   */
  async handleSentFile(filePath) {
    this.logger.silly(`handleSentFile(${filePath})`)
    const count = await databaseService.getFileCount(this.filesDatabase, filePath)
    if (count === 0) {
      if (this.archiveMode) {
        const archivedFilename = path.basename(filePath)
        const archivePath = path.join(this.archiveFolder, archivedFilename)
        // Move original file into the archive folder
        fs.rename(filePath, archivePath, (renameError) => {
          if (renameError) {
            this.logger.error(renameError)
          } else {
            this.logger.info(`File ${filePath} moved to ${archivePath}`)
          }
        })
      } else {
        // Delete original file
        fs.unlink(filePath, (unlinkError) => {
          if (unlinkError) {
            this.logger.error(unlinkError)
          } else {
            this.logger.info(`File ${filePath} deleted`)
          }
        })
      }
    }
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   * @return {void}
   */
  async refreshArchiveFolder() {
    this.logger.silly('Parse archive folder to empty old files')
    // if a process already occurs, it clears it
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout)
    }

    const files = fs.readdirSync(this.archiveFolder)
    const timestamp = new Date().getTime()
    if (files.length > 0) {
      files.forEach((file) => {
        const stats = fs.statSync(path.join(this.archiveFolder, file))

        if (stats.mtimeMs + this.retentionDuration < timestamp) {
          // local try catch in case an error occurs on a file
          // if so, the loop goes on with the other files
          try {
            fs.unlink(path.join(this.archiveFolder, file), (unlinkError) => {
              if (unlinkError) {
                this.logger.error(unlinkError)
              } else {
                this.logger.debug(`File ${path.join(this.archiveFolder, file)} removed from archive`)
              }
            })
          } catch (sendFileError) {
            this.logger.error(`Error sending the file ${file}: ${sendFileError.message}`)
          }
        }
      })
    } else {
      this.logger.debug(`The archive folder ${this.archiveFolder} is empty. Nothing to delete`)
    }
    this.archiveTimeout = setTimeout(() => {
      this.refreshArchiveFolder()
    }, ARCHIVE_TIMEOUT)
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
      name: `${api.name} (${mode})`,
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
    const valuesTotalCounts = pointApis.map((api) => this.cacheStats[api.name])
    const valuesCacheSizeActions = pointApis.map((api) => databaseService.getCount(api.database))
    const valuesCacheSizes = await Promise.all(valuesCacheSizeActions)
    const pointApisStats = this.generateApiCacheStat(pointApis, valuesTotalCounts, valuesCacheSizes, 'points')

    // Get file APIs stats
    const fileApis = Object.values(this.apis).filter((api) => api.canHandleFiles)
    const filesTotalCounts = fileApis.map((api) => this.cacheStats[api.name])
    const filesCacheSizeActions = fileApis.map((api) => databaseService.getFileCountForApi(this.filesDatabase, api.name))
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
