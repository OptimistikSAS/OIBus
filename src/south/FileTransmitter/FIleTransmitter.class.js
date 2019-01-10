const fs = require('fs')
const ProtocolHandler = require('../ProtocolHandler.class')

class FileTransmitter extends ProtocolHandler {
  connect() {
    this.engine.register('notifyEnd', this.handleFile.bind(this))
    const { FT: parameters } = this.equipment
    const { inputFolder, outputFolder, minAge, handlingMode, regex } = parameters
    this.inputFolder = inputFolder
    this.outputFolder = outputFolder
    this.minAge = minAge
    this.handlingMode = handlingMode
    this.regex = regex
    this.pattern = new RegExp(this.regex)
  }

  onScan(_scanMode) {
    fs.readdir(this.inputFolder, (err, files) => {
      if (err) {
        this.logger.error(err)
        return
      }
      if (!files.length) this.logger.info(`The folder ${this.inputFolder} is empty.`)
      files.forEach((filename) => {
        this.checkFile(filename)
      })
    })
  }

  handleFile(file) {
    if (!this.handlingMode || (this.handlingMode === 'Move' && !this.outputFolder)) {
      this.logger.error('Error in configurations')
    } else if (this.handlingMode === 'Delete') {
      fs.unlink(file, (err) => {
        if (err) throw err
        this.logger.info('File: ', file, 'deleted.')
      })
    } else if (this.handlingMode === 'Move') {
      const newFile = file.replace(this.inputFolder, this.outputFolder)
      fs.rename(file, newFile, (erro) => {
        if (erro) {
          this.logger.error(erro)
        }
      })
      this.logger.info('File move to ', newFile)
    }
  }

  /**
   * Poll the file concerned to the connecter of North
   * @param {*} filename: The name of the file
   * @returns {void}
   */
  pollFile(filename) {
    this.logger.info('Poll ', `${this.inputFolder}${filename}`)
    this.engine.postFile(`${this.inputFolder}${filename}`)
  }

  /**
   * Check the file to verify if the name and the age of the file meet the request
   * @param {*} filename:  The name of the file
   * @returns {void}
   */
  checkFile(filename) {
    if (this.pattern.test(filename)) {
      fs.stat(`${this.inputFolder}${filename}`, (err, stats) => {
        const current = new Date().getTime()
        if (err) throw err
        else if (current - stats.atimeMs > this.minAge) {
          this.pollFile(filename)
        }
      })
    } else {
      this.logger.info('This file ', filename, " doesn't matche ", this.regex)
    }
  }
}

module.exports = FileTransmitter
