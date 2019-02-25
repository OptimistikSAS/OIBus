const fs = require('fs')
const path = require('path')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class RawFile
 */
class RawFile extends ProtocolHandler {
  /**
   * Constructor for RawFile
   * @constructor
   * @param {Object} equipment - The equipment
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(equipment, engine) {
    super(equipment, engine)

    const { RawFile: parameters } = this.equipment
    const { inputFolder, archiveFolder, minAge, handlingMode, regex } = parameters

    this.inputFolder = path.resolve(inputFolder)
    this.archiveFolder = path.resolve(archiveFolder)
    this.minAge = minAge
    this.handlingMode = handlingMode
    this.regex = new RegExp(regex)
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  onScan(_scanMode) {
    // Check if input folder exists
    if (!fs.existsSync(this.inputFolder)) {
      this.logger.info(`The input folder ${this.inputFolder} doesn't exist.`)
      return
    }

    // List files in the inputFolder and manage them.
    fs.readdir(this.inputFolder, (error, files) => {
      if (error) {
        this.logger.error(error)
        return
      }

      if (files.length > 0) {
        const matchedFiles = files.filter(this.checkFile.bind(this))
        matchedFiles.forEach(this.sendFile.bind(this))
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

      matched = (stats.atimeMs < (timestamp - this.minAge))
    }

    return matched
  }

  /**
   * Send the file to the Engine.
   * @param {String} filename - The filename
   * @return {void}
   */
  sendFile(filename) {
    const filePath = path.join(this.inputFolder, filename)

    this.logger.debug(`Sending ${filePath} to Engine.`)

    this.engine.addFile(filePath)
  }
}

module.exports = RawFile
