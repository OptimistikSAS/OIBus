const fs = require('fs/promises')
const path = require('path')

const ProtocolHandler = require('../ProtocolHandler.class')

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

    const { inputFolder, preserveFiles, ignoreModifiedDate, minAge, regex, compression } = this.dataSource.FolderScanner

    this.inputFolder = path.resolve(inputFolder)
    this.preserveFiles = preserveFiles
    this.ignoreModifiedDate = ignoreModifiedDate
    this.minAge = minAge
    this.regex = new RegExp(regex)
    this.compression = compression

    this.handlesFiles = true
  }

  /**
   * Filter the files if the name and the age of the file meet the request
   * or (when preserveFiles)if they were already sent.
   * @param {String} filename - file
   * @returns {Array} - Whether the file matches the conditions
   */
  async checkAge(filename) {
    // check age
    const timestamp = new Date().getTime()
    const stats = await fs.stat(path.join(this.inputFolder, filename))
    this.logger.silly(`checkConditions: mT:${stats.mtimeMs} + mA ${this.minAge} < ts:${timestamp}  = ${stats.mtimeMs + this.minAge < timestamp}`)
    if (stats.mtimeMs + this.minAge > timestamp) return false
    this.logger.silly(`checkConditions: ${filename} match age`)
    // check if the file was already sent (if preserveFiles is true)
    if (this.preserveFiles) {
      if (this.ignoreModifiedDate) return true
      const modifyTime = await this.getConfig(filename)
      if (parseFloat(modifyTime) >= stats.mtimeMs) return false
      this.logger.silly(`${filename} modified time ${modifyTime} => need to be sent`)
    }
    return true
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {*} scanMode - The scan mode
   * @return {void}
   */
  async onScanImplementation(scanMode) {
    // List files in the inputFolder
    let files = []
    try {
      files = await fs.readdir(this.inputFolder)
    } catch (error) {
      this.logger.error(`could not read folder ${this.inputFolder} - error: ${error})`)
      return
    }

    if (files.length === 0) {
      this.logger.debug(`The folder ${this.inputFolder} is empty. (scanmode:${scanMode})`)
      return
    }
    // filters file that don't match the regex
    const filteredFiles = files.filter((file) => file.match(this.regex))
    if (filteredFiles.length === 0) {
      this.logger.debug(`no files in ${this.inputFolder} matches regex ${this.regex} (scanmode:${scanMode})is empty.`)
      return
    }
    // filters file that may still currently modified (based on last modifcation date)
    const promisesResults = await Promise.allSettled(filteredFiles.map(this.checkAge.bind(this)))
    const matchedFiles = filteredFiles.filter((_v, index) => promisesResults[index])
    if (matchedFiles.length === 0) {
      this.logger.debug(`no files in ${this.inputFolder} passed checkAge. (scanmode:${scanMode}).`)
      return
    }
    // the files remaining after these checks need to be sent to the bus
    matchedFiles.forEach(async (file) => {
      try {
        await this.sendFile(file)
      } catch (sendFileError) {
        this.logger.error(`Error sending the file ${file}: ${sendFileError.message}`)
      }
    })
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
      try {
        // Compress and send the compressed file
        const gzipPath = `${filePath}.gz`
        await this.compress(filePath, gzipPath)
        await this.addFile(gzipPath, false)

        // Delete original file if preserveFile is not set
        if (!this.preserveFiles) {
          await fs.unlink(filePath)
        }
      } catch (compressionError) {
        this.logger.error(`Error compressing file ${filename}. Sending it raw instead`)
        await this.addFile(filePath, this.preserveFiles)
      }
    } else {
      await this.addFile(filePath, this.preserveFiles)
    }

    if (this.preserveFiles) {
      const stats = await fs.stat(path.join(this.inputFolder, filename))
      this.logger.debug(`Upsert handled file ${filename} with modify time ${stats.mtimeMs}`)
      await this.setConfig(filename, `${stats.mtimeMs}`)
    }
  }
}

module.exports = FolderScanner
