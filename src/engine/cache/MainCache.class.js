const fs = require('node:fs/promises')

const databaseService = require('../../services/database.service')

class MainCache {
  static valuesErrorDatabase = null

  static filesErrorDatabase = null

  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} cacheFolder - The Engine cache folder
   * @return {void}
   */
  constructor(northId, logger, cacheFolder) {
    this.northId = northId
    this.logger = logger

    this.cacheFolder = cacheFolder
    this.databasePath = `${this.cacheFolder}/${this.northId}.db`
    this.database = null
  }

  /**
   * Initialize and return the value error database singleton
   * @param {Logger} logger - The logger
   * @param {string} cacheFolder - The cache folder
   * @return {object} - The value error database
   */
  static getValuesErrorDatabaseInstance(logger, cacheFolder) {
    if (!MainCache.valuesErrorDatabase) {
      const valuesErrorDatabasePath = `${cacheFolder}/valueCache-error.db`
      logger.debug(`Initialize values error db: ${valuesErrorDatabasePath}`)
      MainCache.valuesErrorDatabase = databaseService.createValueErrorsDatabase(valuesErrorDatabasePath)
      logger.debug(`Values error db count: ${databaseService.getCount(MainCache.valuesErrorDatabase)}`)
    }

    return MainCache.valuesErrorDatabase
  }

  /**
   * Initialize and return the file error database singleton
   * @param {Logger} logger - The logger
   * @param {string} cacheFolder - The cache folder
   * @return {object} - The file error database
   */
  static getFilesErrorDatabaseInstance(logger, cacheFolder) {
    if (!MainCache.filesErrorDatabase) {
      const filesErrorDatabasePath = `${cacheFolder}/fileCache-error.db`
      logger.debug(`Initialize files error db: ${filesErrorDatabasePath}`)
      MainCache.filesErrorDatabase = databaseService.createFilesDatabase(filesErrorDatabasePath)
      logger.debug(`Files error db count: ${databaseService.getCount(MainCache.filesErrorDatabase)}`)
    }

    return MainCache.filesErrorDatabase
  }

  /**
   * Initialize and return the file database singleton
   * @param {Logger} logger - The logger
   * @param {string} cacheFolder - The cache folder
   * @return {object} - The file database
   */
  static getFilesDatabaseInstance(logger, cacheFolder) {
    if (!MainCache.filesDatabase) {
      const filesDatabasePath = `${cacheFolder}/fileCache.db`
      logger.debug(`Initialize files db: ${filesDatabasePath}`)
      MainCache.filesDatabase = databaseService.createFilesDatabase(filesDatabasePath)
      logger.debug(`Files db count: ${databaseService.getCount(MainCache.filesDatabase)}`)
    }

    return MainCache.filesDatabase
  }

  /**
   * Transfer the file into the cache folder.
   * @param {Logger} logger - The logger
   * @param {string} filePath - The file path
   * @param {string} cachePath - The cache path
   * @param {boolean} preserveFiles - Whether to preserve the file
   * @returns {Promise<void>} - The result promise
   */
  static async transferFile(logger, filePath, cachePath, preserveFiles) {
    logger.debug(`transferFile(${filePath}) - preserveFiles:${preserveFiles}, cachePath:${cachePath}`)

    if (preserveFiles) {
      await fs.copyFile(filePath, cachePath)
    } else {
      try {
        await fs.rename(filePath, cachePath)
      } catch (renameError) {
        // In case of cross-device link error we copy+delete instead
        if (renameError.code !== 'EXDEV') {
          throw renameError
        }
        logger.debug('Cross-device link error during rename, copy+paste instead')
        await fs.copyFile(filePath, cachePath)
        try {
          await fs.unlink(filePath)
        } catch (unlinkError) {
          logger.error(unlinkError)
        }
      }
    }
  }
}

module.exports = MainCache
