const fs = require('node:fs/promises')

const databaseService = require('../../services/database.service')
const MainCache = require('./MainCache.class')

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class ValueCache extends MainCache {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} cacheFolder - The Engine cache folder
   * @return {void}
   */
  constructor(
    northId,
    logger,
    cacheFolder,
  ) {
    super(
      northId,
      logger,
      cacheFolder,
    )

    this.valuesErrorDatabase = null
  }

  /**
   * Initialize the value cache services.
   * @returns {Promise<void>} - The result promise
   */
  async initialize() {
    try {
      await fs.stat(this.cacheFolder)
    } catch (error) {
      this.logger.info(`Creating cache folder: "${this.cacheFolder}".`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }

    this.valuesErrorDatabase = MainCache.getValuesErrorDatabaseInstance(this.logger, this.cacheFolder)

    this.logger.debug(`Use cache database: "${this.databasePath}".`)
    this.database = databaseService.createValuesDatabase(this.databasePath, {})
    this.logger.debug(`Number of values in the cache: ${databaseService.getCount(this.database)}.`)
  }

  /**
   * Save values  from a South connector to the North cache database
   * @param {string} southId - The South connector id
   * @param {object} values - values
   * @returns {void} - The result promise
   */
  cacheValues(southId, values) {
    if (values.length > 0) {
      databaseService.saveValues(this.database, southId, values)
    }
  }

  /**
   * Retrieve values from the Cache database and send them to the associated northHandleValuesFunction function
   * This method is called when the group count is reached or when the Cache timeout is reached
   * @param {Number} max - Maximum number of values to retrieve
   * @returns {Object[]} - The result promise
   */
  retrieveValuesFromCache(max) {
    return databaseService.getValuesToSend(this.database, max)
  }

  removeValuesFromCache(values) {
    const removed = databaseService.removeSentValues(this.database, values)
    this.logger.debug(`${removed} values removed from cache.`)
  }

  manageErroredValues(values) {
    databaseService.saveErroredValues(this.valuesErrorDatabase, this.northId, values)
    const removed = databaseService.removeSentValues(this.database, values)
    this.logger.error(`${removed} values removed from cache and saved to values error database.`)
  }

  isEmpty() {
    return databaseService.getCount(this.database) > 0
  }
}

module.exports = ValueCache
