const fs = require('node:fs/promises')
const path = require('node:path')

const { createFolder } = require('../utils')

const FILE_FOLDER = 'files'
const ERROR_FOLDER = 'files-errors'

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class FileCacheService {
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
    this.fileFolder = path.resolve(this.baseFolder, FILE_FOLDER)
    this.errorFolder = path.resolve(this.baseFolder, ERROR_FOLDER)
  }

  /**
   * Create folders and check errors files
   * @returns {Promise<void>} - The result promise
   */
  async start() {
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
  }

  /**
   * Stop the archive timeout and close the databases
   * @return {void}
   */
  stop() {
    this.logger.info('stopping file cache')
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
}

module.exports = FileCacheService
