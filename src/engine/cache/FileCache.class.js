const fs = require('node:fs/promises')

const databaseService = require('../../services/database.service')
const MainCache = require('./MainCache.class')

// Time between two checks of the Archive Folder
// const ARCHIVE_TIMEOUT = 3600000 // one hour

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class FileCache extends MainCache {
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

    // TODO: manage archive in North
    // this.archiveMode = engineCacheConfig.archive.enabled
    // this.archiveFolder = path.resolve(engineCacheConfig.archive.archiveFolder)
    // this.retentionDuration = (engineCacheConfig.archive.retentionDuration) * 3600000

    this.filesErrorDatabase = null
  }

  /**
   * Initialize the value cache.
   * @returns {Promise<void>} - The result promise
   */
  async initialize() {
    try {
      await fs.stat(this.cacheFolder)
    } catch (error) {
      this.logger.info(`Creating cache folder: ${this.cacheFolder}`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }
    // try {
    //   await fs.stat(this.archiveFolder)
    // } catch (error) {
    //   this.logger.info(`Creating archive folder: ${this.archiveFolder}`)
    //   await fs.mkdir(this.archiveFolder, { recursive: true })
    // }

    this.database = MainCache.getFilesDatabaseInstance(this.logger, this.cacheFolder)
    this.filesErrorDatabase = MainCache.getFilesErrorDatabaseInstance(this.logger, this.cacheFolder)

    // if (this.archiveMode) {
    //   // refresh the archiveFolder at the beginning only if retentionDuration is different from 0
    //   if (this.retentionDuration > 0) {
    //     this.refreshArchiveFolder()
    //   }
    // }
  }

  /**
   * Cache a new file from a South connector
   * @param {String} filePath - The path of the file
   * @param {number} timestamp - The timestamp the file was received
   * @returns {Promise<void>} - The result promise
   */
  async cacheFile(filePath, timestamp) {
    this.logger.debug(`Cache file "${filePath}".`)
    databaseService.saveFile(this.database, timestamp, this.northId, filePath)
  }

  /**
   * Retrieve files from the Cache database and send them to the associated northHandleFileFunction function
   * This method is called when the group count is reached or when the Cache timeout is reached
   * @returns {Object} - The result promise
   */
  retrieveFileFromCache() {
    return databaseService.getFileToSend(this.database, this.northId)
  }

  manageErroredFiles(filePath) {
    databaseService.saveFile(this.filesErrorDatabase, new Date().getTime(), this.northId, filePath)
    databaseService.deleteSentFile(this.database, this.northId, filePath)

    // TODO: move into file error folder
  }

  /**
   * Remove file from North connector cache.
   * @param {string} filePath - The file to remove
   * @return {Promise<void>} -
   */
  async removeFileFromCache(filePath) {
    databaseService.deleteSentFile(this.database, this.northId, filePath)

    // if (this.archiveMode) {
    //   const archivedFilename = path.basename(filePath)
    //   const archivePath = path.join(this.archiveFolder, archivedFilename)
    //   // Move original file into the archive folder
    //   try {
    //     await fs.rename(filePath, archivePath)
    //     this.logger.info(`File ${filePath} moved to ${archivePath}`)
    //   } catch (renameError) {
    //     this.logger.error(renameError)
    //   }
    // } else {
    //   // Delete original file
    //   try {
    //     await fs.unlink(filePath)
    //     this.logger.info(`File ${filePath} deleted`)
    //   } catch (unlinkError) {
    //     this.logger.error(unlinkError)
    //   }
    // }
    // Delete original file
    try {
      await fs.unlink(filePath)
      this.logger.info(`File ${filePath} deleted`)
    } catch (unlinkError) {
      this.logger.error(unlinkError)
    }
  }
  //
  // /**
  //  * Delete files in archiveFolder if they are older thant the retention time.
  //  * @return {void}
  //  */
  // async refreshArchiveFolder() {
  //   this.logger.debug('Parse archive folder to empty old files')
  //   // if a process already occurs, it clears it
  //   if (this.archiveTimeout) {
  //     clearTimeout(this.archiveTimeout)
  //   }
  //
  //   const files = await fs.readdir(this.archiveFolder)
  //   const timestamp = new Date().getTime()
  //   if (files.length > 0) {
  //     // eslint-disable-next-line no-restricted-syntax
  //     for (const file of files) {
  //       // eslint-disable-next-line no-await-in-loop
  //       const stats = await fs.stat(path.join(this.archiveFolder, file))
  //       if (stats.mtimeMs + this.retentionDuration < timestamp) {
  //         try {
  //           // eslint-disable-next-line no-await-in-loop
  //           await fs.unlink(path.join(this.archiveFolder, file))
  //           this.logger.debug(`File ${path.join(this.archiveFolder, file)} removed from archive`)
  //         } catch (unlinkError) {
  //           this.logger.error(unlinkError)
  //         }
  //       }
  //     }
  //   } else {
  //     this.logger.debug(`The archive folder ${this.archiveFolder} is empty. Nothing to delete`)
  //   }
  //   this.archiveTimeout = setTimeout(() => {
  //     this.refreshArchiveFolder()
  //   }, ARCHIVE_TIMEOUT)
  // }

  /**
   * Initialize and return the file cache singleton
   * @param {string} northId - The North connector ID
   * @param {Logger} logger - The logger
   * @param {object} engineCacheConfig - The Engine cache settings
   * @return {FileCache} - The file cache
   */
  static async getFileCacheInstance(
    northId,
    logger,
    engineCacheConfig,
  ) {
    if (!FileCache.fileCache) {
      FileCache.fileCache = new FileCache(
        northId,
        logger,
        engineCacheConfig,
      )
      await FileCache.fileCache.initialize()
    }

    return FileCache.fileCache
  }

  isEmpty() {
    return databaseService.getFileCountForNorthConnector(this.database, this.northId) > 0
  }
}

module.exports = FileCache
