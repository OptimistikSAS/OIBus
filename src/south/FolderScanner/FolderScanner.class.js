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
    const { inputFolder, preserve: preserveFiles, minAge, regex, compression } = this.dataSource.FolderScanner

    this.inputFolder = path.resolve(inputFolder)
    this.preserveFiles = preserveFiles
    this.minAge = minAge
    this.regex = new RegExp(regex)
    this.compression = compression
  }

  async connect() {
    const { dataSourceId, protocol } = this.dataSource
    this.logger.info(`Data source ${dataSourceId} started with protocol ${protocol}`)
    if (this.preserveFiles) {
      const { engineConfig } = this.engine.configService.getConfig()
      const databasePath = `${engineConfig.caching.cacheFolder}/${dataSourceId}.db`
      this.database = await databaseService.createFolderScannerDatabase(databasePath)
    }
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {*} scanMode - The scan mode
   * @return {void}
   */
  async onScan(scanMode) {
    this.logger.silly(`FolderScanner activated on scanMode: ${scanMode}.`)
    // Check if input folder exists
    if (!fs.existsSync(this.inputFolder)) {
      this.logger.warn(`The input folder ${this.inputFolder} doesn't exist.`)
      return
    }

    // List files in the inputFolder and manage them.
    try {
      const files = fs.readdirSync(this.inputFolder)
      if (files.length > 0) {
        // Disable ESLint check because we need for..of loop to support async calls
        // eslint-disable-next-line no-restricted-syntax
        for (const file of files) {
          // Disable ESLint check because we want to handle files one by one
          // eslint-disable-next-line no-await-in-loop
          const matchConditions = await this.checkConditions(file)
          if (matchConditions) {
            // eslint-disable-next-line no-await-in-loop
            await this.sendFile(file)
          }
        }
      } else {
        this.logger.debug(`The folder ${this.inputFolder} is empty.`)
      }
    } catch (error) {
      this.logger.error(`The input folder ${this.inputFolder} is not readable: ${error.stack}`)
    }
  }

  /**
   * Filter the files if the name and the age of the file meet the request
   * or (when preserveFiles)if they were already sent.
   * @param {String} filename - file
   * @returns {Array} - Whether the file matches the conditions
   */
  async checkConditions(filename) {
    // check regexp
    if (!this.regex.test(filename)) return false
    this.logger.silly(`checkConditions:${filename} match regexp`)
    // check age
    const timestamp = new Date().getTime()
    const stats = fs.statSync(path.join(this.inputFolder, filename))
    this.logger.silly(`checkConditions: mT:${stats.mtimeMs} + mA ${this.minAge} < ts:${timestamp}  = ${stats.mtimeMs + this.minAge < timestamp}`)
    if (stats.mtimeMs + this.minAge > timestamp) return false
    this.logger.silly(`checkConditions: ${filename} match age`)
    // check if the file was already sent (if preserveFiles is true)
    if (this.preserveFiles) {
      const modifyTime = await databaseService.getFolderScannerModifyTime(this.database, filename)
      if (modifyTime >= stats.mtimeMs) return false
      this.logger.silly(`${filename} modified time ${modifyTime} => need to be sent`)
    }
    return true
  }

  /**
   * Send the file to the Engine.
   * @param {String} filename - The filename
   * @return {void}
   */
  async sendFile(filename) {
    const filePath = path.join(this.inputFolder, filename)
    this.logger.debug(`Sending ${filePath} to Engine.`)

    if (this.compression) {
      // Compress and send the compressed file
      const gzipPath = `${filePath}.gz`
      await this.compress(filePath, gzipPath)
      await this.addFile(gzipPath, false)

      // Delete original file if preserveFile is not set
      if (!this.preserveFiles) {
        fs.unlink(filePath, (unlinkError) => {
          if (unlinkError) {
            this.logger.error(unlinkError)
          } else {
            this.logger.info(`File ${filePath} compressed and deleted`)
          }
        })
      }
    } else {
      await this.addFile(filePath, this.preserveFiles)
    }

    if (this.preserveFiles) {
      const stats = fs.statSync(path.join(this.inputFolder, filename))
      this.logger.debug(`Upsert handled file ${filename} with modify time ${stats.mtimeMs}`)
      await databaseService.upsertFolderScanner(this.database, filename, stats.mtimeMs)
    }
  }
}

module.exports = FolderScanner
