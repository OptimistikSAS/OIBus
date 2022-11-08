const fs = require('node:fs/promises')
const path = require('node:path')

const { createFolder } = require('../../service/utils')

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000 // one hour

const ERROR_FOLDER = 'errors'
const ARCHIVE_FOLDER = 'archive'
const FILE_FOLDER = 'files'

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class FileCache {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} baseFolder - The North cache folder generated as north-connectorId. This base folder can
   * be in data-stream or history-query folder depending on the connector use case
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
    this.northId = northId
    this.logger = logger
    this.baseFolder = baseFolder
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

    try {
      const files = await fs.readdir(this.fileFolder)
      if (files.length > 0) {
        this.logger.debug(`${files.length} files in cache.`)
      } else {
        this.logger.debug('No files in cache.')
      }
    } catch (error) {
      // If the folder does not exist, an error is logged but OIBus keep going to check errors and archive folders
      this.logger.error(error)
    }

    try {
      const errorFiles = await fs.readdir(this.errorFolder)
      if (errorFiles.length > 0) {
        this.logger.warn(`${errorFiles.length} files in error cache.`)
      } else {
        this.logger.debug('No error files in cache.')
      }
    } catch (error) {
      // If the folder does not exist, an error is logged but not thrown if the file cache folder is accessible
      this.logger.error(error)
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
    let fileNames = []
    try {
      fileNames = await fs.readdir(this.fileFolder)
    } catch (error) {
      this.logger.error(error)
    }

    if (fileNames.length === 0) {
      return null
    }

    const fileStats = []
    // Get file stats one after the other
    await fileNames.reduce((promise, fileName) => promise.then(
      async () => {
        try {
          const stat = await fs.stat(path.resolve(this.fileFolder, fileName))
          fileStats.push({
            path: path.resolve(this.fileFolder, fileName),
            timestamp: stat.mtime.getTime(),
          })
        } catch (error) {
          // If a file is being written or corrupted, the stat method can fail
          // An error is logged and the cache goes through the other files
          this.logger.error(error)
        }
      },
    ), Promise.resolve())

    const sortedFiles = fileStats.sort((a, b) => a.timestamp - b.timestamp)

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
        this.logger.debug(`File "${filePathInCache}" moved to "${archivePath}".`)
      } catch (renameError) {
        this.logger.error(renameError)
      }
    } else {
      // Delete original file
      try {
        await fs.unlink(filePathInCache)
        this.logger.debug(`File "${filePathInCache}" removed from disk.`)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    }
  }

  /**
   * Check if the file cache is empty or not
   * @returns {Promise<Boolean>} - Cache empty or not
   */
  async isEmpty() {
    let files = []
    try {
      files = await fs.readdir(this.fileFolder)
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this.logger.error(error)
    }
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

    let files = []
    try {
      files = await fs.readdir(this.archiveFolder)
    } catch (error) {
      // If the archive folder doest not exist (removed by the user for example), an error is logged
      this.logger.error(error)
    }
    if (files.length > 0) {
      const referenceDate = new Date().getTime()

      // Map each file to a promise and remove files sequentially
      await files.reduce((promise, file) => promise.then(
        async () => this.removeFileIfTooOld(file, referenceDate, this.archiveFolder),
      ), Promise.resolve())
    } else {
      this.logger.debug(`The archive folder "${this.archiveFolder}" is empty. Nothing to delete.`)
    }
    this.archiveTimeout = setTimeout(this.refreshArchiveFolder.bind(this), ARCHIVE_TIMEOUT)
  }

  /**
   * Check the modified time of a file and remove it if older than the retention duration
   * @param {String} filePath - The path of the file to remove
   * @param {Number} referenceDate - The reference date (in ms)
   * @param {String} archiveFolder - The archive folder
   * @returns {Promise<void>} - The result promise
   */
  async removeFileIfTooOld(filePath, referenceDate, archiveFolder) {
    let stats
    try {
      // If a file is being written or corrupted, the stat method can fail an error is logged
      stats = await fs.stat(path.join(archiveFolder, filePath))
    } catch (error) {
      this.logger.error(error)
    }
    if (stats && stats.mtimeMs + this.retentionDuration < referenceDate) {
      try {
        await fs.unlink(path.join(archiveFolder, filePath))
        this.logger.debug(`File "${path.join(archiveFolder, filePath)}" removed from archive.`)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    }
  }
}

module.exports = FileCache
