const fs = require('node:fs/promises')
const path = require('node:path')

const BaseCache = require('./BaseCache.class')
const { createFolder } = require('../../services/utils')

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000 // one hour

const ERROR_FOLDER = 'errors'
const ARCHIVE_FOLDER = 'archive'
const FILE_FOLDER = 'files'

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class FileCache extends BaseCache {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} baseFolder - The North cache folder
   * @param {Boolean} archiveFiles - If the archive mode for this North connector is enabled
   * @param {Number} retentionDuration - File retention duration in archive folder (in hours)
   * @return {void}
   */
  constructor(
    northId,
    logger,
    baseFolder,
    archiveFiles,
    retentionDuration,
  ) {
    super(
      northId,
      logger,
      baseFolder,
    )

    this.archiveFiles = archiveFiles
    // Convert from hours to ms to compare with mtimeMs (file modified time in ms)
    this.retentionDuration = retentionDuration * 3600000
    this.archiveFolder = path.resolve(this.baseFolder, ARCHIVE_FOLDER)
    this.fileFolder = path.resolve(this.baseFolder, FILE_FOLDER)
    this.errorFolder = path.resolve(this.baseFolder, ERROR_FOLDER)

    this.archiveTimeout = null
  }

  /**
   * Create databases, folders and activate archive cleanup if needed
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    await createFolder(this.fileFolder)
    await createFolder(this.errorFolder)

    const files = await fs.readdir(this.fileFolder)
    if (files.length > 0) {
      this.logger.debug(`${files.length} files in cache.`)
    } else {
      this.logger.debug('No files in cache.')
    }

    const errorFiles = await fs.readdir(this.errorFolder)
    if (errorFiles.length > 0) {
      this.logger.warn(`${errorFiles.length} files in error cache.`)
    } else {
      this.logger.debug('No error files in cache.')
    }

    if (this.archiveFiles) {
      await createFolder(this.archiveFolder)
      // refresh the archiveFolder at the beginning only if retentionDuration is different from 0
      if (this.retentionDuration > 0) {
        this.refreshArchiveFolder()
      }
    }
  }

  /**
   * Stop the archive timeout and close the databases
   * @return {void}
   */
  stop() {
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout)
    }
  }

  /**
   * Cache a new file from a South connector
   * @param {String} filePath - The path of the file
   * @returns {Promise<void>} - The result promise
   */
  async cacheFile(filePath) {
    this.logger.debug(`Caching file "${filePath}"...`)
    const timestamp = new Date().getTime()
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath)

    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`
    const cachePath = path.join(this.fileFolder, cacheFilename)

    await fs.copyFile(filePath, cachePath)
    this.logger.debug(`File "${filePath}" cached in "${cachePath}".`)
  }

  /**
   * Retrieve files from the Cache database and send them to the associated northHandleFileFunction function
   * This method is called when the group count is reached or when the Cache timeout is reached
   * @returns {Promise<{path: string, timestamp: number}|null>} - The file to send
   */
  async retrieveFileFromCache() {
    const fileNames = await fs.readdir(this.fileFolder)

    if (fileNames.length === 0) {
      return null
    }

    const sortedFiles = fileNames
      .map(async (fileName) => ({
        path: path.resolve(this.fileFolder, fileName),
        timestamp: (await fs.stat(`${this.fileFolder}/${fileName}`)).mtime.getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)

    return sortedFiles[0]
  }

  /**
   * Save the file in the error database and remove it from the cache database
   * Move the file from North cache database to its error folder
   * @param {String} filePathInCache - The file to move
   * @returns {Promise<void>} - The result promise
   */
  async manageErroredFiles(filePathInCache) {
    const filenameInfo = path.parse(filePathInCache)
    const errorPath = path.join(this.errorFolder, filenameInfo.base)
    // Move cache file into the archive folder
    try {
      await fs.rename(filePathInCache, errorPath)
      this.logger.info(`File "${filePathInCache}" moved to "${errorPath}".`)
    } catch (renameError) {
      this.logger.error(renameError)
    }
  }

  /**
   * Remove file from North connector cache and place it to archive folder if required.
   * @param {String} filePathInCache - The file to remove
   * @param {Boolean} archiveFile - If the file must be archived or not
   * @return {Promise<void>} - The result promise
   */
  async removeFileFromCache(filePathInCache, archiveFile) {
    if (archiveFile) {
      const filenameInfo = path.parse(filePathInCache)
      const archivePath = path.join(this.archiveFolder, filenameInfo.base)
      // Move cache file into the archive folder
      try {
        await fs.rename(filePathInCache, archivePath)
        this.logger.info(`File "${filePathInCache}" moved to "${archivePath}".`)
      } catch (renameError) {
        this.logger.error(renameError)
      }
    } else {
      // Delete original file
      try {
        await fs.unlink(filePathInCache)
        this.logger.info(`File ${filePathInCache} removed from disk.`)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    }
  }

  /**
   * Check if the file cache is empty or not
   * @returns {Boolean} - Cache empty or not
   */
  async isEmpty() {
    const files = await fs.readdir(this.fileFolder)
    return files.length === 0
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   * @return {void}
   */
  async refreshArchiveFolder() {
    this.logger.debug('Parse archive folder to remove old files.')
    // If a timeout already runs, clear it
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout)
    }

    const files = await fs.readdir(this.archiveFolder)
    const referenceDate = new Date().getTime()
    if (files.length > 0) {
      // Map each file to a promise and remove files sequentially
      await files.reduce((promise, file) => promise.then(
        async () => this.removeFileIfTooOld(file, referenceDate, this.archiveFolder),
      ), Promise.resolve())
    } else {
      this.logger.debug(`The archive folder ${this.archiveFolder} is empty. Nothing to delete`)
    }
    this.archiveTimeout = setTimeout(() => {
      this.refreshArchiveFolder()
    }, ARCHIVE_TIMEOUT)
  }

  /**
   * Check the modified time of a file and remove it if older than the retention duration
   * @param {String} filePath - The path of the file to remove
   * @param {Number} referenceDate - The reference date (in ms)
   * @param {String} archiveFolder - The archive folder
   * @returns {Promise<void>} - The result promise
   */
  async removeFileIfTooOld(filePath, referenceDate, archiveFolder) {
    const stats = await fs.stat(path.join(archiveFolder, filePath))
    if (stats.mtimeMs + this.retentionDuration < referenceDate) {
      try {
        await fs.unlink(path.join(archiveFolder, filePath))
        this.logger.debug(`File ${path.join(archiveFolder, filePath)} removed from archive`)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    }
  }
}

module.exports = FileCache
