const path = require('node:path')
const fs = require('node:fs/promises')
const { filesExists } = require('../utils')

const CLEAN_UP_INTERVAL = 24 * 3600 * 1000 // One day

/**
 * Service used to clean up log files rolled by the pino-roll library
 * This service should be removed if pino-roll implements this feature one day
 */
class FileCleanupService {
  /**
   * @param {String} logFolder - The path of the log folder
   * @param {Logger} logger - The logger
   * @param {String} filename - The filename pattern
   * @param {Number} numberOfFiles - The number of files to keep
   */
  constructor(
    logFolder,
    logger,
    filename,
    numberOfFiles,
  ) {
    this.logFolder = path.resolve(logFolder)
    this.logger = logger
    this.filename = filename
    this.numberOfFiles = numberOfFiles
    this.cleanUpInterval = null
  }

  /**
   * Clean up the folder at start and then every CLEAN_UP_INTERVAL ms
   * @return {void}
   */
  async start() {
    await this.cleanUpLogFiles()
    this.cleanUpInterval = setInterval(this.cleanUpLogFiles.bind(this), CLEAN_UP_INTERVAL)
  }

  /**
   * Clear the interval when OIBus stop
   * @return {void}
   */
  stop() {
    this.logger.trace('Stopping file cleanup service.')
    clearInterval(this.cleanUpInterval)
  }

  /**
   * List the files of the log folder and remove the older files if the number of files is over the limit of files
   * @return {Promise<void>} - The result promise
   */
  async cleanUpLogFiles() {
    try {
      if (!await filesExists(this.logFolder)) {
        return
      }
      const filenames = await fs.readdir(this.logFolder)

      const regexp = new RegExp(`^${this.filename}\\.[0-9]*$`)
      const fileList = []
      const logFiles = filenames.filter((file) => file.match(regexp))

      this.logger.trace(`Found ${logFiles.length} log files with RegExp ${regexp} in folder "${this.logFolder}".`)
      if (logFiles.length > this.numberOfFiles) {
        await logFiles.reduce((promise, filename) => promise.then(
          async () => {
            try {
              const fileStat = await fs.stat(path.resolve(this.logFolder, filename))
              fileList.push({ file: path.resolve(this.logFolder, filename), modifiedTime: fileStat.mtimeMs })
            } catch (error) {
              // If a file is being written or corrupted, the stat method can fail
              // An error is logged and the cache goes through the other files
              this.logger.error(`Error while reading log file "${path.resolve(this.logFolder, filename)}": ${error}`)
            }
          },
        ), Promise.resolve())

        // Sort the newest files first and keep the numberOfFiles first files (the other files will be removed
        const fileToRemove = fileList.sort((a, b) => a.modifiedTime - b.modifiedTime)
          .map((element) => element.file)
          .slice(0, fileList.length - this.numberOfFiles)
        this.logger.trace(`Removing ${fileToRemove.length} log files.`)
        await fileToRemove.reduce((promise, filename) => promise.then(
          async () => {
            try {
              await fs.unlink(path.resolve(this.logFolder, filename))
            } catch (error) {
              // If a file is being written or corrupted, the stat method can fail
              // An error is logged and the cache goes through the other files
              this.logger.error(`Error while removing log file "${path.resolve(this.logFolder, filename)}": ${error}`)
            }
          },
        ), Promise.resolve())
      }
    } catch (error) {
      this.logger.error(error)
    }
  }
}

module.exports = FileCleanupService
