const path = require('node:path')

const databaseService = require('../../service/database.service')

const VALUES_DB_FILE_NAME = 'values.db'
const VALUES_ERROR_DB_FILE_NAME = 'values-error.db'

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class ValueCache {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} baseFolder - The North cache folder generated as north-connectorId. This base folder can
   * be in data-stream or history-query folder depending on the connector use case
   * @return {void}
   */
  constructor(
    northId,
    logger,
    baseFolder,
  ) {
    this.northId = northId
    this.logger = logger
    this.baseFolder = baseFolder
  }

  /**
   * Create databases and folders
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    const valuesDatabasePath = path.resolve(this.baseFolder, VALUES_DB_FILE_NAME)
    this.logger.debug(`Use value cache database: "${valuesDatabasePath}".`)
    this.valuesDatabase = databaseService.createValuesDatabase(valuesDatabasePath, {})
    const valuesCount = databaseService.getCount(this.valuesDatabase)
    if (valuesCount > 0) {
      this.logger.debug(`${valuesCount} values in cache.`)
    } else {
      this.logger.debug('No values in cache.')
    }

    const valuesErrorDatabasePath = path.resolve(this.baseFolder, VALUES_ERROR_DB_FILE_NAME)
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
   * Save values from a South connector to the North cache database
   * @param {String} southId - The South connector id
   * @param {Object} values - The values to cache
   * @returns {void}
   */
  cacheValues(southId, values) {
    databaseService.saveValues(this.valuesDatabase, southId, values)
  }

  /**
   * Retrieve values from the Cache database and send them to the associated northHandleValuesFunction function
   * This method is called when the group count is reached or when the Cache timeout is reached
   * @param {Number} max - Maximum number of values to retrieve
   * @returns {Object[]} - The values to send
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
   * Retrieve the number of values stored in the cache
   * @returns {Number} - The number of values
   */
  getNumberOfValues() {
    return databaseService.getCount(this.valuesDatabase)
  }

  /**
   * Check if the file cache is empty or not
   * @returns {Boolean} - Cache empty or not
   */
  isEmpty() {
    return databaseService.getCount(this.valuesDatabase) === 0
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
