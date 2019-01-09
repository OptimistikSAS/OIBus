const fs = require('fs')
const ProtocolHandler = require('../ProtocolHandler.class')

class FileTransmitter extends ProtocolHandler {
  connect() {
    this.engine.register()
    const { FT: parameters } = this.equipment
    const { inputFolder, outputFolder, minAge, handlingMode, regex } = parameters
    this.inputFolder = inputFolder
    this.outputFolder = outputFolder
    this.minAge = minAge
    this.handlingMode = handlingMode
    this.regex = regex
  }

  onScan(_scanMode) {
    fs.readdir(this.inputFolder, (err, files) => {
      if (err) {
        console.error(err)
        return
      }
      if (!files.length) console.info(`The folder ${this.inputFolder} is empty.`)
      files.forEach((filename) => {
        this.checkFile(filename)
      })
    })
  }

  handleFile(filename) {
    if (!this.handlingMode || (this.handlingMode === 'Move' && !this.outputFolder)) {
      console.error('Error in configurations')
    } else if (this.handlingMode === 'Delete') {
      //   fs.unlink(`${this.inputFolder}${filename}`, (err) => {
      //     if (err) throw err
      //     console.info('File: ', `${this.inputFolder}${filename}`, 'deleted.')
      //   })
    } else if (this.handlingMode === 'Move') {
      fs.rename(`${this.inputFolder}${filename}`, `${this.outputFolder}${filename}`, (erro) => {
        if (erro) {
          console.error(erro)
        }
      })
      console.info('File move to ', `${this.outputFolder}${filename}`)
    }
  }

  /**
   * Poll the file concerned to the connecter of North
   * @param {*} filename: The name of the file
   * @returns {void}
   */
  pollFile(filename) {
    console.info('Poll ', `${this.inputFolder}${filename}`)
    this.engine.postFile(new File(`${this.inputFolder}${filename}`))
    this.handleFile(filename)
  }

  /**
   * Check the file to verify if the name and the age of the file meet the request
   * @param {*} filename:  The name of the file
   * @returns {void}
   */
  checkFile(filename) {
    const pattern = new RegExp(this.regex)
    if (pattern.test(filename)) {
      fs.stat(`${this.inputFolder}${filename}`, (err, stats) => {
        const current = new Date().getTime()
        if (err) throw err
        else if (current - stats.atimeMs > this.minAge) {
          this.pollFile(filename)
        }
      })
    } else {
      console.info('This file ', filename, " doesn't matche ", this.regex)
    }
  }
}

module.exports = FileTransmitter
