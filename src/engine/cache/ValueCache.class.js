const fs = require('fs/promises')
const path = require('path')

const databaseService = require('../../services/database.service')
const MainCache = require('./MainCache.class')

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class ValueCache {
  constructor(api, queue, engineCacheConfig) {
    this.api = api
    this.logger = api.logger
    this.apiCacheConfig = api.application.caching
    this.queue = queue
    const cacheFolderPath = path.resolve(engineCacheConfig.cacheFolder)
    this.cacheFolder = cacheFolderPath
    this.databasePath = `${cacheFolderPath}/${api.application.id}.db`
    this.valuesErrorDatabase = null
    this.database = null
    this.timeout = null
    this.sendInProgress = false
    this.resendImmediately = false
    this.cacheStat = 0
  }

  /**
   * Initialize the value cache.
   * @returns {Promise<void>} - The result
   */
  async initialize() {
    this.valuesErrorDatabase = MainCache.getValuesErrorDatabaseInstance(this.logger, this.cacheFolder)
    try {
      await fs.stat(this.cacheFolder)
    } catch (error) {
      this.logger.info(`Creating cache folder: ${this.cacheFolder}`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }

    this.logger.debug(`Use db: ${this.databasePath} for ${this.api.application.name}`)
    this.database = databaseService.createValuesDatabase(this.databasePath, {})
    this.logger.debug(`Value db count: ${databaseService.getCount(this.database)}`)

    if (this.apiCacheConfig?.sendInterval) {
      this.resetTimeout(this.apiCacheConfig.sendInterval)
    } else {
      this.logger.warn(`Application "${this.api.name}" has no sendInterval`)
    }
  }

  /**
   * Cache a new Value from the South
   * @param {string} id - The data source id
   * @param {object} values - values
   * @returns {Promise<void>} - The result
   */
  async cacheValues(id, values) {
    // Update stat
    this.cacheStat = (this.cacheStat || 0) + values.length

    await this.queue.add(databaseService.saveValues, this.database, this.api.engine.activeProtocols[id]?.dataSource.name || id, values)
    // If the group size is over the groupCount => we immediately send the cache
    // to the North even if the timeout is not finished.
    const count = databaseService.getCount(this.database)
    if (count >= this.apiCacheConfig.groupCount) {
      this.logger.trace(`groupCount reached: ${count} >= ${this.apiCacheConfig.groupCount}`)
      await this.sendCallback()
    }
  }

  /**
   * Callback function used by the timer to send the values to the North application.
   * @returns {Promise<void>} - The result
   */
  async sendCallback() {
    let status = MainCache.STATUS.SUCCESS

    this.logger.trace(`sendCallback ${this.api.application.name}, sendInProgress ${!!this.sendInProgress}`)

    if (!this.sendInProgress) {
      this.sendInProgress = true
      this.resendImmediately = false

      status = await this.sendValues()

      const successTimeout = this.resendImmediately ? 0 : this.apiCacheConfig.sendInterval
      const timeout = (status === MainCache.STATUS.SUCCESS) ? successTimeout : this.apiCacheConfig.retryInterval
      this.resetTimeout(timeout)

      this.sendInProgress = false
    } else {
      this.resendImmediately = true
    }
  }

  /**
   * Send values.
   * @return {ApiHandler.Status} - The callback status
   */
  async sendValues() {
    const { id, name } = this.api.application
    this.logger.trace(`Cache sendCallbackForValues() for ${name}`)

    try {
      const values = databaseService.getValuesToSend(this.database, this.apiCacheConfig.maxSendCount)
      let removed = null

      if (values.length) {
        this.logger.trace(`Cache:sendCallbackForValues() got ${values.length} values to send to ${name}`)
        let successCountStatus
        try {
          successCountStatus = await this.api.handleValues(values)
        } catch (error) {
          successCountStatus = error
        }
        this.logger.trace(`Cache:handleValuesFromCache, successCountStatus: ${successCountStatus}, Application: ${name}`)

        // If there was a logic error
        if (successCountStatus === MainCache.STATUS.LOGIC_ERROR) {
          // Add errored values into error table
          this.logger.trace(`Cache:addErroredValues, add ${values.length} values to error database for ${name}`)
          await this.queue.add(databaseService.saveErroredValues, this.valuesErrorDatabase, id, values)

          // Remove them from the cache table
          removed = databaseService.removeSentValues(this.database, values)
          this.logger.trace(`Cache:removeSentValues, removed: ${removed} AppId: ${name}`)
          if (removed !== values.length) {
            this.logger.debug(`Cache for ${name} can't be deleted: ${removed}/${values.length}`)
          }
        }
        // If some values were successfully sent
        if (successCountStatus > 0) {
          const valuesSent = values.slice(0, successCountStatus)
          removed = databaseService.removeSentValues(this.database, valuesSent)
          this.logger.trace(`Cache:removeSentValues, removed: ${removed} AppId: ${name}`)
          if (removed !== valuesSent.length) {
            this.logger.debug(`Cache for ${name} can't be deleted: ${removed}/${valuesSent.length}`)
          }
        }
      } else {
        this.logger.trace(`no values in the db for ${name}`)
      }
      return MainCache.STATUS.SUCCESS
    } catch (error) {
      this.logger.error(error)
      return MainCache.STATUS.COMMUNICATION_ERROR
    }
  }

  async getStats() {
    const cacheSize = databaseService.getCount(this.database)
    return {
      name: `${this.api.application.name} (points)`,
      count: this.cacheStat || 0,
      cache: cacheSize || 0,
    }
  }

  /**
   * Reset timer.
   * @param {number} timeout - The timeout to wait
   * @return {void}
   */
  resetTimeout(timeout) {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.timeout = setTimeout(this.sendCallback.bind(this), timeout)
  }

  /**
   * Stop the cache.
   * @return {void}
   */
  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }
}

module.exports = ValueCache
