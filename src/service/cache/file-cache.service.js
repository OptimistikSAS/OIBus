const fs = require('node:fs/promises')
const path = require('node:path')

const { createFolder } = require('../utils')
const DeferredPromise = require('../deferred-promise')

const RESEND_IMMEDIATELY_TIMEOUT = 100

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
   @param {Function} northSendFilesCallback - Method used by the North to handle values
   @param {Function} northShouldRetryCallback - Method used by the North to retry or not the sending
   @param {Object} settings - Cache settings
   * @return {void}
   */
  constructor(
    northId,
    logger,
    baseFolder,
    northSendFilesCallback,
    northShouldRetryCallback,
    settings,
  ) {
    this.northId = northId
    this.logger = logger
    this.baseFolder = baseFolder
    this.northSendFilesCallback = northSendFilesCallback
    this.northShouldRetryCallback = northShouldRetryCallback
    this.settings = settings

    this.filesTimeout = null
    this.sendingFilesInProgress = false
    this.sendNextImmediately = false
    this.filesRetryCount = 0
    this.sendingFile$ = null
    this.filesQueue = [] // List of object {fileName, creationAt}
    this.fileBeingSent = null

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

    const files = await fs.readdir(this.fileFolder)

    this.filesQueue = []
    await files.reduce((promise, fileName) => promise.then(
      async () => {
        try {
          const fileStat = await fs.stat(path.resolve(this.fileFolder, fileName))
          this.filesQueue.push({ fileName: path.resolve(this.fileFolder, fileName), createdAt: fileStat.ctimeMs })
        } catch (error) {
          // If a file is being written or corrupted, the stat method can fail
          // An error is logged and the cache goes through the other files
          this.logger.error(`Error while reading queue file "${path.resolve(this.fileFolder, fileName)}": ${error}`)
        }
      },
    ), Promise.resolve())
    // Sort the compact queue to have the oldest file first
    this.filesQueue.sort((a, b) => a.createdAt - b.createdAt)
    if (this.filesQueue.length > 0) {
      this.logger.debug(`${this.filesQueue.length} files in cache.`)
    } else {
      this.logger.debug('No files in cache.')
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

    if (this.settings.sendInterval) {
      this.resetFilesTimeout(this.settings.sendInterval)
    } else {
      this.logger.warn('No send interval. No file will be sent.')
    }
  }

  /**
   * Reset timer.
   * @param {number} timeout - The timeout to wait
   * @return {void}
   */
  resetFilesTimeout(timeout) {
    clearTimeout(this.filesTimeout)
    this.filesTimeout = setTimeout(this.sendFileWrapper.bind(this), timeout)
  }

  /**
   * Wrapper for the send file method to catch an error when used in a timer
   * @returns {Promise<void>} - The result promise
   */
  async sendFileWrapper() {
    try {
      await this.sendFile()
    } catch (error) {
      this.logger.error(error)
    }
  }

  async sendFile() {
    if (this.sendingFilesInProgress) {
      this.logger.trace('Already sending files...')
      this.sendNextImmediately = true
      return
    }

    // If no file is already set to be sent, retrieve it
    // It may happen that fileToSend is already set, especially when the northSendValues
    // fails. In this case, the cache must retry until it manages the error and reset valuesBeingSent
    this.sendingFilesInProgress = true
    // This deferred promise allows the connector to wait for the end of this method before stopping
    this.sendingFile$ = new DeferredPromise()
    if (!this.fileBeingSent) {
      this.fileBeingSent = await this.getFileToSend()
    }

    if (!this.fileBeingSent) {
      this.logger.trace('No file to send...')
      this.sendingFilesInProgress = false
      this.sendingFile$.resolve()
      this.resetFilesTimeout(this.settings.sendInterval)
      return
    }

    this.logger.debug(`Handling file "${this.fileBeingSent}".`)
    try {
      await this.northSendFilesCallback(this.fileBeingSent)
      const indexToRemove = this.filesQueue.findIndex((queueFile) => queueFile === this.fileBeingSent)
      if (indexToRemove > -1) {
        this.filesQueue.splice(indexToRemove, 1)
      }
      // Reset the fileBeingSent to retrieve the next file to send at the next call
      this.fileBeingSent = null
      this.filesRetryCount = 0
    } catch (error) {
      this.logger.error(`Error when sending file (retry ${this.filesRetryCount}): ${error}`)
      if (this.filesRetryCount < this.settings.retryCount || this.northShouldRetryCallback(error)) {
        this.filesRetryCount += 1
        this.logger.debug(`Retrying file in ${this.settings.retryInterval} ms. Retry count: ${this.filesRetryCount}`)
      } else {
        this.logger.debug('Too many retries. The file won\'t be sent again.')

        this.logger.trace(`Moving ${this.fileBeingSent} file into error cache: "${this.errorFolder}".`)
        await this.manageErroredFiles(this.fileBeingSent)

        this.fileBeingSent = null
        this.filesRetryCount = 0
      }
    }

    if (this.sendNextImmediately) {
      this.resetFilesTimeout(RESEND_IMMEDIATELY_TIMEOUT)
    } else {
      this.resetFilesTimeout(this.filesRetryCount > 0 ? this.settings.retryInterval : this.settings.sendInterval)
    }
    this.sendingFilesInProgress = false
    this.sendingFile$.resolve()
  }

  /**
   * Retrieve the file from the queue
   * @returns {Promise<String>} - The file to send
   */
  async getFileToSend() {
    // If there is no file in the queue, return null
    if (this.filesQueue.length === 0) {
      return null
    }
    // Otherwise, get the first element from the queue
    const [queueFile] = this.filesQueue
    return path.resolve(this.fileFolder, queueFile)
  }

  /**
   * Stop the timeout
   * @return {void}
   */
  async stop() {
    if (this.sendingFile$) {
      this.logger.debug('Waiting for connector to finish sending file...')
      await this.sendingFile$.promise
    }
    clearTimeout(this.filesTimeout)
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
    // Add the file to the queue once it is persisted in the cache folder
    this.filesQueue.push(cachePath)
    this.logger.debug(`File "${filePath}" cached in "${cachePath}".`)
  }

  /**
   * Retrieve files from the Cache folder and send them to the associated northHandleFileFunction function
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
   * Save the file in the error database and remove it from the cache folder
   * Move the file from North cache folder to its error folder
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
