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

    /** @todo migration for preserve to be added */
    const { inputFolder, preserve: preserveFiles, minAge, regex } = this.dataSource.FolderScanner

    this.inputFolder = path.resolve(inputFolder)
    this.preserveFiles = preserveFiles
    this.minAge = minAge
    this.regex = new RegExp(regex)
  }

  async connect() {
    super.connect()
    if (this.preserveFiles) {
      const { engineConfig } = this.engine.configService.getConfig()
      const databasePath = `${engineConfig.caching.cacheFolder}/${this.dataSource.dataSourceId}.db`
      this.database = await databaseService.createFolderScannerDatabase(databasePath)
    }
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {*} scanMode - The scan mode
   * @return {void}
   */
  onScan(scanMode) {
    this.logger.silly(`FolderScanner activated on scanMode: ${scanMode}.`)
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
        const matchedFiles = await this.keepMatchingFiles(files)
        this.sendFiles(matchedFiles)
      } else {
        this.logger.debug(`The folder ${this.inputFolder} is empty.`)
      }
    })
  }

  /**
   * Filter the files if the name and the age of the file meet the request
   * or (when preserveFiles)if they were already sent.
   * @param {String} filenames - file
   * @returns {Array} - Whether the file matches the conditions
   */

  async keepMatchingFiles(filenames) {
    const modifiedDate = this.preserveFiles && Object.fromEntries(
      await Promise.all(
        filenames.map((filename) => databaseService.getFolderScannerModifyTime(this.database, filename)),
      ),
    )
    const filteredFiles = filenames.filter((filename) => {
      let matched = false
      if (this.regex.test(filename)) {
        const timestamp = new Date().getTime()
        const stats = fs.statSync(path.join(this.inputFolder, filename))
        this.logger.silly(`checkFile ts:${timestamp} mT:${stats.mtimeMs} mA ${this.minAge}`)
        matched = stats.mtimeMs < timestamp - this.minAge
        this.logger.silly(`checkFile ${filename} matched ${matched}`)
        // now check if the file was already sent if preserveFiles is true)
        if (matched && this.preserveFiles) {
          if (modifiedDate[filename] >= stats.mtimeMs) {
            this.logger.silly(`${filename} with modified Date ${modifiedDate} was already sent`)
            matched = false
          }
        }
      }
      return matched
    })
    return filteredFiles
  }

  /**
   * Send the files to the Engine.
   * @param {String} filenames - The filename
   * @return {void}
   */
  sendFiles(filenames) {
    filenames.forEach(async (filename) => {
      const filePath = path.join(this.inputFolder, filename)

      this.logger.debug(`Sending ${filePath} to Engine.`)
      this.addFile(filePath)

      if (this.preserveFiles) {
        const stats = fs.statSync(path.join(this.inputFolder, filename))
        this.logger.debug(`Upsert handled file ${filename} with modify time ${stats.mtimeMs}`)
        await databaseService.upsertFolderScanner(this.database, filename, stats.mtimeMs)
      }
    })
  }
}

module.exports = FolderScanner
