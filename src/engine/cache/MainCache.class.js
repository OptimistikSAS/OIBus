const databaseService = require('../../services/database.service')

class MainCache {
  static STATUS = {
    SUCCESS: 0,
    LOGIC_ERROR: -1,
    COMMUNICATION_ERROR: -2,
  }

  static valuesErrorDatabase = null

  static filesErrorDatabase = null

  /**
   * Initialize and return the value error database singleton
   * @param {Logger} logger - The logger
   * @param {string} cacheFolder - The cache folder
   * @return {Promise<sqlite.Database>} - The value error database
   */
  static async getValuesErrorDatabaseInstance(logger, cacheFolder) {
    if (!MainCache.valuesErrorDatabase) {
      const valuesErrorDatabasePath = `${cacheFolder}/valueCache-error.db`
      logger.debug(`Initialize values error db: ${valuesErrorDatabasePath}`)
      MainCache.valuesErrorDatabase = await databaseService.createValueErrorsDatabase(valuesErrorDatabasePath)
      logger.debug(`Values error db count: ${await databaseService.getCount(MainCache.valuesErrorDatabase)}`)
    }

    return MainCache.valuesErrorDatabase
  }

  /**
   * Initialize and return the file error database singleton
   * @param {Logger} logger - The logger
   * @param {string} cacheFolder - The cache folder
   * @return {Promise<sqlite.Database>} - The file error database
   */
  static async getFilesErrorDatabaseInstance(logger, cacheFolder) {
    if (!MainCache.filesErrorDatabase) {
      const filesErrorDatabasePath = `${cacheFolder}/fileCache-error.db`
      logger.debug(`Initialize files error db: ${filesErrorDatabasePath}`)
      MainCache.filesErrorDatabase = await databaseService.createFilesDatabase(filesErrorDatabasePath)
      logger.debug(`Files error db count: ${await databaseService.getCount(MainCache.filesErrorDatabase)}`)
    }

    return MainCache.filesErrorDatabase
  }
}

module.exports = MainCache
