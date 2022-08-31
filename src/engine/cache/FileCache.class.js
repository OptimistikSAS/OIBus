const fs = require('fs/promises')
const path = require('path')

const databaseService = require('../../services/database.service')
const MainCache = require('./MainCache.class')

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000 // one hour

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class FileCache {
  constructor(api, engineCacheConfig) {
    this.api = api
    this.logger = api.logger
    this.apiCacheConfig = api.application.caching
    const {
      cacheFolder,
      archive,
    } = engineCacheConfig
    this.cacheFolder = path.resolve(cacheFolder)
    this.archiveMode = archive.enabled
    this.archiveFolder = path.resolve(archive.archiveFolder)
    this.retentionDuration = (archive.retentionDuration) * 3600000
    this.filesErrorDatabase = null
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
    this.database = MainCache.getFilesDatabaseInstance(this.logger, this.cacheFolder)
    this.filesErrorDatabase = MainCache.getFilesErrorDatabaseInstance(this.logger, this.cacheFolder)

    try {
      await fs.stat(this.cacheFolder)
    } catch (error) {
      this.logger.info(`Creating cache folder: ${this.cacheFolder}`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }

    try {
      await fs.stat(this.archiveFolder)
    } catch (error) {
      this.logger.info(`Creating archive folder: ${this.archiveFolder}`)
      await fs.mkdir(this.archiveFolder, { recursive: true })
    }

    if (this.archiveMode) {
      // refresh the archiveFolder at the beginning only if retentionDuration is different from 0
      if (this.retentionDuration > 0) {
        this.refreshArchiveFolder()
      }
    }

    if (this.apiCacheConfig?.sendInterval) {
      this.resetTimeout(this.apiCacheConfig.sendInterval)
    } else {
      this.logger.warn(`Application "${this.api.name}" has no sendInterval`)
    }
  }

  /**
   * Cache a new Value from the South
   * @param {String} cachePath - The path of the raw file
   * @param {number} timestamp - The timestamp the file was received
   * @returns {Promise<void>} - The result
   */
  async cacheFile(cachePath, timestamp) {
    // Update stat
    this.cacheStat = (this.cacheStat || 0) + 1

    this.logger.debug(`cacheFileForApi() ${cachePath} for api: ${this.api.application.name}`)
    databaseService.saveFile(this.database, timestamp, this.api.application.id, cachePath)

    this.sendCallback()
  }

  /**
   * Callback function used by the timer to send the values to the North application.
   * @returns {Promise<void>} - The result
   */
  async sendCallback() {
    this.logger.trace(`sendCallback ${this.api.application.name}, sendInProgress ${!!this.sendInProgress}`)

    if (!this.sendInProgress) {
      this.sendInProgress = true
      this.resendImmediately = false

      const status = await this.sendFile()

      const successTimeout = this.resendImmediately ? 0 : this.apiCacheConfig.sendInterval
      const timeout = (status === MainCache.STATUS.SUCCESS) ? successTimeout : this.apiCacheConfig.retryInterval
      this.resetTimeout(timeout)

      this.sendInProgress = false
    } else {
      this.resendImmediately = true
    }
  }

  async sendFile() {
    const { id, name } = this.api.application
    this.logger.trace(`sendFile() for ${name}`)

    try {
      const fileToSend = databaseService.getFileToSend(this.database, id)

      if (!fileToSend) {
        this.logger.trace('sendFile(): no file to send')
        return MainCache.STATUS.SUCCESS
      }

      this.logger.trace(`sendFile() file:${fileToSend.path}`)

      try {
        await fs.stat(fileToSend.path)
      } catch (error) {
        // file in cache does not exist on filesystem
        databaseService.deleteSentFile(this.database, id, fileToSend.path)
        this.logger.error(new Error(`${fileToSend.path} not found! Removing it from db.`))
        return MainCache.STATUS.SUCCESS
      }
      this.logger.trace(`sendFile(${fileToSend.path}) call sendFile() ${name}`)
      const status = await this.api.handleFile(fileToSend.path)
      switch (status) {
        case MainCache.STATUS.SUCCESS:
          this.logger.trace(`sendFile(${fileToSend.path}) deleteSentFile for ${name}`)
          databaseService.deleteSentFile(this.database, id, fileToSend.path)
          await this.handleSentFile(fileToSend.path)
          break
        case MainCache.STATUS.LOGIC_ERROR:
          this.logger.error(`sendFile(${fileToSend.path}) move to error database for ${name}`)
          databaseService.saveFile(this.filesErrorDatabase, fileToSend.timestamp, id, fileToSend.path)

          this.logger.trace(`sendFile(${fileToSend.path}) deleteSentFile for ${name}`)
          databaseService.deleteSentFile(this.database, id, fileToSend.path)
          break
        default:
          break
      }
      return status
    } catch (error) {
      this.logger.error(error)
      return MainCache.STATUS.COMMUNICATION_ERROR
    }
  }

  /**
   * Remove file if it was sent to all North.
   * @param {string} filePath - The file
   * @return {void}
   */
  async handleSentFile(filePath) {
    this.logger.trace(`handleSentFile(${filePath})`)
    const count = databaseService.getFileCount(this.database, filePath)
    if (count === 0) {
      if (this.archiveMode) {
        const archivedFilename = path.basename(filePath)
        const archivePath = path.join(this.archiveFolder, archivedFilename)
        // Move original file into the archive folder
        try {
          await fs.rename(filePath, archivePath)
          this.logger.info(`File ${filePath} moved to ${archivePath}`)
        } catch (renameError) {
          this.logger.error(renameError)
        }
      } else {
        // Delete original file
        try {
          await fs.unlink(filePath)
          this.logger.info(`File ${filePath} deleted`)
        } catch (unlinkError) {
          this.logger.error(unlinkError)
        }
      }
    }
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   * @return {void}
   */
  async refreshArchiveFolder() {
    this.logger.debug('Parse archive folder to empty old files')
    // if a process already occurs, it clears it
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout)
    }

    const files = await fs.readdir(this.archiveFolder)
    const timestamp = new Date().getTime()
    if (files.length > 0) {
      // eslint-disable-next-line no-restricted-syntax
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const stats = await fs.stat(path.join(this.archiveFolder, file))
        if (stats.mtimeMs + this.retentionDuration < timestamp) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await fs.unlink(path.join(this.archiveFolder, file))
            this.logger.debug(`File ${path.join(this.archiveFolder, file)} removed from archive`)
          } catch (unlinkError) {
            this.logger.error(unlinkError)
          }
        }
      }
    } else {
      this.logger.debug(`The archive folder ${this.archiveFolder} is empty. Nothing to delete`)
    }
    this.archiveTimeout = setTimeout(() => {
      this.refreshArchiveFolder()
    }, ARCHIVE_TIMEOUT)
  }

  async getStats(apiName) {
    const cacheSize = databaseService.getFileCountForNorthConnector(this.database, apiName)
    return {
      name: `${this.api.application.name} (files)`,
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

  /**
   * Initialize and return the file cache singleton
   * @param {ApiHandler} api - The api
   * @param {object} engineCacheConfig - The engine cache config
   * @return {FileCache} - The file cache
   */
  static async getFileCacheInstance(api, engineCacheConfig) {
    if (!FileCache.fileCache) {
      FileCache.fileCache = new FileCache(api, engineCacheConfig)
      await FileCache.fileCache.initialize()
    }

    return FileCache.fileCache
  }
}

module.exports = FileCache
