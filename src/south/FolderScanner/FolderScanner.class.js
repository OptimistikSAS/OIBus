const fs = require('fs')
const path = require('path')

const ProtocolHandler = require('../ProtocolHandler.class')
const databaseService = require('../../services/database.service')

/**
 * Class FolderScanner
 */
class FolderScanner extends ProtocolHandler {
  /**
   * Constructor for FolderScanner
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const { inputFolder, preserveFiles, minAge, regex } = this.dataSource

    this.inputFolder = path.resolve(inputFolder)
    this.preserveFiles = preserveFiles
    this.minAge = minAge
    this.regex = new RegExp(regex)
  }

  async connect() {
    if (this.preserveFiles) {
      const { engineConfig } = this.engine.configService.getConfig()
      const databasePath = `${engineConfig.caching.cacheFolder}/${this.dataSource.dataSourceId}.db`
      this.database = await databaseService.createFolderScannerDatabase(databasePath)
    }
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  onScan(_scanMode) {
    // Check if input folder exists
    if (!fs.existsSync(this.inputFolder)) {
      this.logger.warn(`The input folder ${this.inputFolder} doesn't exist.`)
      return
    }

    // List files in the inputFolder and manage them.
    fs.readdir(this.inputFolder, async (error, files) => {
      if (error) {
        this.logger.error(error)
        return
      }

      if (files.length > 0) {
        let filesToHandle = []

        const matchedFiles = files.filter(this.checkFile.bind(this))

        if (this.preserveFiles) {
          filesToHandle = await this.filterHandledFiles(matchedFiles)
        } else {
          filesToHandle = matchedFiles
        }

        filesToHandle.forEach(this.sendFile.bind(this))
      } else {
        this.logger.debug(`The folder ${this.inputFolder} is empty.`)
      }
    })
  }

  /**
   * Check the file to verify if the name and the age of the file meet the request
   * @param {String} filename - The name of the file
   * @returns {Boolean} - Whether the file matches the conditions
   */
  checkFile(filename) {
    let matched = false

    if (this.regex.test(filename)) {
      const timestamp = new Date().getTime()
      const stats = fs.statSync(path.join(this.inputFolder, filename))

      matched = (stats.mtimeMs < (timestamp - this.minAge))
    }

    return matched
  }

  /**
   * Filter out already handled files.
   * @param {string[]} filenames - The files to check
   * @return {string[]} - The filtered files
   */
  async filterHandledFiles(filenames) {
    const filesToHandle = []

    await Promise.all(filenames.map(async (filename) => {
      const stats = fs.statSync(path.join(this.inputFolder, filename))
      const modified = await databaseService.getFolderScannerModifyTime(this.database, filename)
      if (modified) {
        if ((stats.mtimeMs > modified)) {
          filesToHandle.push(filename)
        }
      } else {
        filesToHandle.push(filename)
      }
    }))

    return filesToHandle
  }

  /**
   * Send the file to the Engine.
   * @param {String} filename - The filename
   * @return {void}
   */
  sendFile(filename) {
    const filePath = path.join(this.inputFolder, filename)

    this.logger.debug(`Sending ${filePath} to Engine.`)

    this.addFile(filePath)

    if (this.preserveFiles) {
      this.storeFile(filename)
    }
  }

  /**
   * Store the file with the modify time.
   * @param {string} filename - The filename
   * @return {void}
   */
  async storeFile(filename) {
    const stats = fs.statSync(path.join(this.inputFolder, filename))

    this.logger.debug(`Upsert handled file ${filename} with modify time ${stats.mtimeMs}`)

    await databaseService.upsertFolderScanner(this.database, filename, stats.mtimeMs)
  }
}

FolderScanner.schema = require('./schema')

module.exports = FolderScanner
