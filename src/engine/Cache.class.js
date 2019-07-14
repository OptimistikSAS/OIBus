const fs = require('fs')
const path = require('path')

const databaseService = require('../services/database.service')

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
    this.logger = engine.logger
    this.engine = engine
    const { config } = engine
    // get parameters for the cache
    const { cacheFolder, archiveFolder, archiveMode } = config.engine.caching
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
    // initialize the internal object apis with the list of north apis
    Object.values(activeApis).forEach(async (activeApi) => {
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
      }
      this.resetTimeout(api, api.config.sendInterval)
      this.apis[api.applicationId] = api
    })
  }

  /**
   * Check whether a North is subscribed to a South
   * @param {string} dataSourceId - The South generating the value
   * @param {string[]} subscribedTo - The list of Souths the North is subscribed to
   * @returns {boolean} - The North is subscribed to the given South
   */
  static isSubscribed(dataSourceId, subscribedTo) {
    if (!subscribedTo) return true
    return Array.isArray(subscribedTo) && subscribedTo.includes(dataSourceId)
  }

  /**
   * Cache a new Value.
   * It will store the value in every database. If doNotGroup is "true" it will immediately forward the value
   * to every North application (used for alarm values for example)
   * @param {string} dataSourceId - The South generating the value
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  async cacheValue(dataSourceId, value, doNotGroup) {
    Object.entries(this.apis).forEach(async ([applicationId, api]) => {
      const { database, config, canHandleValues, subscribedTo } = api

      if (canHandleValues && Cache.isSubscribed(dataSourceId, subscribedTo)) {
        await databaseService.saveValue(database, value)

        if (doNotGroup) {
          this.sendValues(applicationId, [value])
        } else {
          const count = await databaseService.getValuesCount(database)
          if (count >= config.groupCount) {
            this.sendCallback(applicationId)
          }
        }
      }
    })
  }

  /**
   * Cache the new raw file.
   * @param {string} dataSourceId - The South generating the file
   * @param {String} filePath - The path of the raw file
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  async cacheFile(dataSourceId, filePath, preserveFiles) {
    const timestamp = new Date().getTime()
    const cacheFilename = `${path.parse(filePath).name}-${timestamp}${path.parse(filePath).ext}`
    const cachePath = path.join(this.cacheFolder, cacheFilename)

    try {
      if (preserveFiles) {
        fs.copyFile(filePath, cachePath, (copyError) => {
          if (copyError) throw copyError
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
        })
      }
      // All is good so we send the file to the engine
      Object.entries(this.apis).forEach(async ([applicationId, api]) => {
        const { canHandleFiles, subscribedTo } = api
        if (canHandleFiles && Cache.isSubscribed(dataSourceId, subscribedTo)) {
          await databaseService.saveFile(this.filesDatabase, timestamp, applicationId, cachePath)
          this.sendCallback(applicationId)
        }
      })
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Callback function used by the timer to send the values to the given North application.
   * @param {string} applicationId - The application ID
   * @return {void}
   */
  sendCallback(applicationId) {
    const application = this.apis[applicationId]

    if (application.canHandleValues) {
      this.handleValues(application)
    }

    if (application.canHandleFiles) {
      this.handleFiles(application)
    }
  }

  /**
   * Handle value resending.
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async handleValues(application) {
    let success = true

    try {
      const values = await databaseService.getValuesToSend(application.database, application.config.groupCount)

      if (values) {
        success = await this.sendValues(application.applicationId, values)
      }
    } catch (error) {
      this.logger.error(error)
      success = false
    }

    const timeout = success ? application.config.sendInterval : application.config.retryInterval
    this.resetTimeout(application, timeout)
  }

  /**
   * Handle files resending.
   * @param {object} application - The application to send the values to
   * @return {void}
   */
  async handleFiles(application) {
    let timeout = application.config.sendInterval

    try {
      const filePath = await databaseService.getFileToSend(this.filesDatabase, application.applicationId)

      if (filePath) {
        timeout = 1000

        if (fs.existsSync(filePath)) {
          const success = await this.engine.sendFile(application.applicationId, filePath)

          if (success) {
            await databaseService.deleteSentFile(this.filesDatabase, application.applicationId, filePath)
            await this.handleSentFile(filePath)
          } else {
            timeout = application.config.retryInterval
          }
        } else {
          this.logger.error(new Error(`File ${filePath} doesn't exist. Removing it from database.`))

          await databaseService.deleteSentFile(this.filesDatabase, application.applicationId, filePath)
        }
      }
    } catch (error) {
      this.logger.error(error)
    }

    this.resetTimeout(application, timeout)
  }

  /**
   * Send values to a given North application.
   * @param {string} applicationId - The application ID
   * @param {object[]} valueList - The values to send
   * @return {void}
   */
  async sendValues(applicationId, valueList) {
    const success = await this.engine.sendValues(applicationId, valueList)

    if (success) {
      await databaseService.removeSentValues(this.apis[applicationId].database, valueList)
    }

    return success
  }

  /**
   * Remove file if it was sent to all North.
   * @param {string} filePath - The file
   * @return {void}
   */
  async handleSentFile(filePath) {
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
    application.timeout = setTimeout(this.sendCallback.bind(this, application.applicationId), timeout)
  }
}

module.exports = Cache
