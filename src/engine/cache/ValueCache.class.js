const databaseService = require('../../services/database.service')
const BaseCache = require('./BaseCache.class')

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class ValueCache extends BaseCache {
  /**
   * Create databases and folders
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    const valuesDatabasePath = `${this.baseFolder}/values.db`
    this.logger.debug(`Use value cache database: "${valuesDatabasePath}".`)
    this.valuesDatabase = databaseService.createValuesDatabase(valuesDatabasePath, {})
    const valuesCount = databaseService.getCount(this.valuesDatabase)
    if (valuesCount > 0) {
      this.logger.debug(`${valuesCount} values in cache.`)
    } else {
      this.logger.debug('No values in cache.')
    }

    const valuesErrorDatabasePath = `${this.baseFolder}/values-error.db`
    this.logger.debug(`Initialize values error db: ${valuesErrorDatabasePath}`)
    this.valuesErrorDatabase = databaseService.createValueErrorsDatabase(valuesErrorDatabasePath)
    const errorCount = databaseService.getCount(this.valuesErrorDatabase)
    if (errorCount > 0) {
      this.logger.warn(`${errorCount} values in error cache.`)
    } else {
      this.logger.debug('No error values in cache.')
    }
  }

  /**
   * Save values  from a South connector to the North cache database
   * @param {string} southId - The South connector id
   * @param {object} values - values
   * @returns {void} - The result promise
   */
  cacheValues(southId, values) {
    if (values.length > 0) {
      databaseService.saveValues(this.valuesDatabase, southId, values)
    }
  }

  /**
   * Retrieve values from the Cache database and send them to the associated northHandleValuesFunction function
   * This method is called when the group count is reached or when the Cache timeout is reached
   * @param {Number} max - Maximum number of values to retrieve
   * @returns {Object[]} - The result promise
   */
  retrieveValuesFromCache(max) {
    return databaseService.getValuesToSend(this.valuesDatabase, max)
  }

  /**
   * Remove values from North connector cache
   * @param {Object[]} values - The values to remove
   * @return {void}
   */
  removeValuesFromCache(values) {
    const removed = databaseService.removeSentValues(this.valuesDatabase, values)
    this.logger.debug(`${removed} values removed from cache.`)
  }

  /**
   * Remove values from North connector cache and save them to the values error cache db
   * @param {Object[]} values - The values to remove
   * @return {void}
   */
  manageErroredValues(values) {
    databaseService.saveErroredValues(this.valuesErrorDatabase, values)
    const removed = databaseService.removeSentValues(this.valuesDatabase, values)
    this.logger.error(`${removed} values removed from cache and saved to values error database.`)
  }

  /**
   * Check if the file cache is empty or not
   * @returns {Boolean} - Cache empty or not
   */
  isEmpty() {
    return databaseService.getCount(this.valuesDatabase) > 0
  }

  /**
   * Close the databases
   * @return {void}
   */
  stop() {
    this.valuesDatabase.close()
    this.valuesErrorDatabase.close()
  }
}

module.exports = ValueCache
