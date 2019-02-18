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

      if (!files.length) {
        this.logger.debug(`The folder ${this.inputFolder} is empty.`)
      }

      const matchedFiles = files.filter(this.checkFile.bind(this))
      matchedFiles.forEach(this.processFile.bind(this))
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
  processFile(filename) {
    this.logger.debug(`Processing file ${filename}.`)

    const filePath = path.join(this.inputFolder, filename)

    this.engine.addFile(filePath)
      .then((success) => {
        if (success) {
          this.logger.info(`${filePath} sent to Engine`)
          this.handleFile(filename)
        }
      })
  }

  /**
   * Handle the processed file.
   * @param {String} filename - The file to handle
   * @return {void}
   */
  handleFile(filename) {
    const filePath = path.join(this.inputFolder, filename)
    const archivedFilename = `${path.parse(filename).name}-${new Date().getTime()}${path.parse(filename).ext}`
    const archivePath = path.join(this.archiveFolder, archivedFilename)

    switch (this.handlingMode) {
      case 'delete':
        // Delete original file
        fs.unlink(filePath, (error) => {
          if (error) {
            this.logger.error(error)
          } else {
            this.logger.info(`File: ${filename} deleted.`)
          }
        })
        break
      case 'move':
        // Create archive folder if it doesn't exist
        if (!fs.existsSync(this.archiveFolder)) {
          fs.mkdirSync(this.archiveFolder, { recursive: true })
        }

        // Move original file into the archive folder
        fs.rename(filePath, archivePath, (error) => {
          if (error) {
            this.logger.error(error)
          } else {
            this.logger.info(`File: ${filename} moved as ${archivedFilename}.`)
          }
        })
        break
      default:
    }
  }
}

module.exports = RawFile
