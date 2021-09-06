const fs = require('fs')
const path = require('path')

const ProtocolHandler = require('../ProtocolHandler.class')

const NO_ACCESS = 0
const READ_ACCESS_ONLY = 1
const WRITE_READ_ACCESS = 2

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
   * Read the raw file and rewrite it to another file in the folder archive
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  async onScanImplementation(_scanMode) {
    const folderAccess = await this.checkAccess()

    return new Promise((resolve) => {
      if (folderAccess !== NO_ACCESS) {
        // List files in the inputFolder and manage them.
        fs.readdir(this.inputFolder, async (error, files) => {
          if (error) {
            this.logger.error(`Error while reading the input folder ${this.inputFolder}: ${error.message}`)
          }
          if (files.length > 0) {
            // Disable ESLint check because we need for..of loop to support async calls
            // eslint-disable-next-line no-restricted-syntax
            for (const file of files) {
              // Disable ESLint check because we want to handle files one by one
              // eslint-disable-next-line no-await-in-loop
              const matchConditions = await this.checkConditions(file)
              if (matchConditions) {
                // local try catch in case an error occurs on a file
                // if so, the loop goes on with the other files
                try {
                  // eslint-disable-next-line no-await-in-loop
                  await this.sendFile(file, folderAccess)
                } catch (sendFileError) {
                  this.logger.error(`Error sending the file ${file}: ${sendFileError.message}`)
                }
              }
            }
          } else {
            this.logger.debug(`The folder ${this.inputFolder} is empty.`)
          }
          resolve()
        })
      } else {
        this.logger.warn(`No read access for folder ${this.inputFolder}`)
        resolve()
      }
    })
  }

  /**
   * Return the access level of OIBus on the inputFolder
   * @returns {Promise<*>} - The result promise to get the input folder access level
   */
  checkAccess() {
    return new Promise((resolve) => {
      // eslint-disable-next-line max-len
      this.logger.silly(`${this.dataSource.dataSourceId} is checking read access of folder ${this.inputFolder}`)
      // eslint-disable-next-line no-bitwise
      fs.access(this.inputFolder, fs.constants.R_OK, (err) => {
        if (!err) {
          this.logger.silly(`${this.dataSource.dataSourceId} has read access for folder ${this.inputFolder}`)
          // Check if OIBus has write access in case of compression of no preserveFiles option
          if (!this.preserveFiles || this.compression) {
            // eslint-disable-next-line max-len
            this.logger.silly(`${this.dataSource.dataSourceId} is checking write access for folder ${this.inputFolder}`)
            // eslint-disable-next-line no-bitwise
            fs.access(this.inputFolder, fs.constants.R_OK | fs.constants.W_OK, (writeAccessError) => {
              if (!writeAccessError) {
                this.logger.silly(`${this.dataSource.dataSourceId} has write access for folder ${this.inputFolder}`)
                resolve(WRITE_READ_ACCESS)
              } else {
                this.logger.warn(`Write access error of folder "${this.inputFolder}": ${err.message}`)
                resolve(READ_ACCESS_ONLY)
              }
            })
          } else {
            resolve(READ_ACCESS_ONLY)
          }
        } else {
          this.logger.warn(`Read access error of folder "${this.inputFolder}": ${err.message}`)
          resolve(NO_ACCESS)
        }
      })
    })
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
      if (this.ignoreModifiedDate) return true
      const modifyTime = await this.getConfig(filename)
      if (parseFloat(modifyTime) >= stats.mtimeMs) return false
      this.logger.silly(`${filename} modified time ${modifyTime} => need to be sent`)
    }
    return true
  }

  /**
   * Return a promise when the fs.unlink method is done
   * @param {String} filePath - the file to remove
   * @returns {Promise<unknown>} - The promise to resolve
   */
  deleteFile(filePath) {
    return new Promise((resolve) => {
      fs.unlink(filePath, (unlinkError) => {
        if (unlinkError) {
          this.logger.error(unlinkError)
        } else {
          this.logger.info(`File ${filePath} compressed and deleted`)
        }
        resolve()
      })
    })
  }

  /**
   * Send the file to the Engine.
   * @param {String} filename - The filename
   * @param {number} folderAccess - The access rights for the foldeer
   * @return {void}
   */
  async sendFile(filename, folderAccess) {
    const filePath = path.join(this.inputFolder, filename)
    this.logger.debug(`Sending ${filePath} to Engine.`)

    if (this.compression && folderAccess === WRITE_READ_ACCESS) {
      // Compress and send the compressed file
      const gzipPath = `${filePath}.gz`
      await this.compress(filePath, gzipPath)
      await this.addFile(gzipPath, false)

      // Delete original file if preserveFile is not set
      if (!this.preserveFiles) {
        await this.deleteFile(filePath)
      }
    } else if (this.compression && folderAccess !== WRITE_READ_ACCESS) {
      this.logger.debug(`Cannot compress file because of write access error for folder ${this.inputFolder}, the file will be sent raw.`)
      await this.addFile(filePath, this.preserveFiles)
    } else {
      await this.addFile(filePath, this.preserveFiles)
    }

    if (this.preserveFiles) {
      const stats = fs.statSync(path.join(this.inputFolder, filename))
      this.logger.debug(`Upsert handled file ${filename} with modify time ${stats.mtimeMs}`)
      await this.setConfig(filename, `${stats.mtimeMs}`)
    }
  }
}

module.exports = FolderScanner
