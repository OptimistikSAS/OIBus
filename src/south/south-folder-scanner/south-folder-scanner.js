import fs from 'node:fs/promises'
import path from 'node:path'

import SouthConnector from '../south-connector.js'
import { compress } from '../../service/utils.js'
import manifest from './manifest.js'

/**
 * Class SouthFolderScanner - Retrieve file from a local or remote folder
 */
export default class SouthFolderScanner extends SouthConnector {
  static category = manifest.category

  /**
   * Constructor for SouthFolderScanner
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      manifest,
    )

    const {
      inputFolder,
      preserveFiles,
      ignoreModifiedDate,
      minAge,
      regex,
      compression,
    } = configuration.settings

    this.inputFolder = path.resolve(inputFolder)
    this.preserveFiles = preserveFiles
    this.ignoreModifiedDate = ignoreModifiedDate
    this.minAge = minAge
    this.regex = new RegExp(regex)
    this.compression = compression
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {String} scanMode - The scan mode
   * @returns {Promise<void>} - The result promise
   */
  async fileQuery(scanMode) {
    this.logger.trace(`Reading "${this.inputFolder}" directory for scan mode "${scanMode}".`)
    // List files in the inputFolder
    const files = await fs.readdir(this.inputFolder)

    if (files.length === 0) {
      this.logger.debug(`The folder "${this.inputFolder}" is empty.`)
      return
    }

    // Filters file that don't match the regex
    const filteredFiles = files.filter((file) => file.match(this.regex))
    if (filteredFiles.length === 0) {
      this.logger.debug(`No files in "${this.inputFolder}" matches regex ${this.regex}.`)
      return
    }

    // Filters file that may still currently being written (based on last modification date)
    const promisesResults = await Promise.allSettled(filteredFiles.map(this.checkAge.bind(this)))
    const matchedFiles = filteredFiles.filter((_v, index) => promisesResults[index].value)
    if (matchedFiles.length === 0) {
      this.logger.debug(`No files in "${this.inputFolder}" matches minimum last modification date.`)
      return
    }

    // The files remaining after these checks need to be sent to the engine
    this.logger.trace(`Sending ${matchedFiles.length} files`)

    await Promise.allSettled(matchedFiles.map((file) => this.sendFile(file)))
  }

  /**
   * Filter the files if the name and the age of the file meet the request or - when preserveFiles - if they were
   * already sent.
   * @param {String} filename - The file name to check
   * @returns {Boolean} - Whether the file matches the conditions
   */
  async checkAge(filename) {
    const timestamp = new Date().getTime()
    const stats = await fs.stat(path.join(this.inputFolder, filename))
    this.logger.trace(`checkConditions: mT:${stats.mtimeMs} + mA ${this.minAge} < ts:${timestamp} `
     + `= ${stats.mtimeMs + this.minAge < timestamp}.`)

    if (stats.mtimeMs + this.minAge > timestamp) return false
    this.logger.trace(`checkConditions: ${filename} match age`)

    // Check if the file was already sent (if preserveFiles is true)
    if (this.preserveFiles) {
      if (this.ignoreModifiedDate) return true
      const modifyTime = this.getConfig(filename)
      if (parseFloat(modifyTime) >= stats.mtimeMs) return false
      this.logger.trace(`File "${filename}" modified time ${modifyTime} => need to be sent.`)
    }
    return true
  }

  /**
   * Send the file to the Engine.
   * @param {String} filename - The file to send
   * @returns {Promise<void>} - The result promise
   */
  async sendFile(filename) {
    const filePath = path.join(this.inputFolder, filename)
    this.logger.debug(`Sending file "${filePath}" to the engine.`)

    if (this.compression) {
      try {
        // Compress and send the compressed file
        const gzipPath = `${filePath}.gz`
        await compress(filePath, gzipPath)
        await this.addFile(gzipPath, false)

        // Delete original file if preserveFile is not set
        if (!this.preserveFiles) {
          try {
            await fs.unlink(filePath)
          } catch (unlinkError) {
            this.logger.error(unlinkError)
          }
        }
      } catch (compressionError) {
        this.logger.error(`Error compressing file "${filename}". Sending it raw instead.`)
        await this.addFile(filePath, this.preserveFiles)
      }
    } else {
      await this.addFile(filePath, this.preserveFiles)
    }

    if (this.preserveFiles) {
      const stats = await fs.stat(path.join(this.inputFolder, filename))
      this.logger.debug(`Upsert handled file "${filename}" with modify time ${stats.mtimeMs}.`)
      this.setConfig(filename, `${stats.mtimeMs}`)
    }
  }
}
