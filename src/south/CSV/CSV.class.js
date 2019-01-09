const fs = require('fs')
const csv = require('fast-csv')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class CSV
 */
class CSV extends ProtocolHandler {
  /**
   * Read the csv file and rewrite it to another file in the folder archive
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  onScan(_scanMode) {
    const { CSV: parameters } = this.equipment
    const { inputFolder } = parameters

    // list files in the inputFolder and manage them.
    fs.readdir(inputFolder, (err, files) => {
      if (err) {
        this.logger.error(err)
        return
      }
      if (!files.length) this.logger.info(`The folder ${inputFolder} is empty.`)
      files.forEach((filename) => {
        this.processFile(inputFolder, filename)
      })
    })
  }

  /**
   * Load the csv file from the path to an object
   * @todo We may have to handle very large files that can't be read in one pass.
   * cf http://c2fo.io/fast-csv/index.html
   *
   * @param {String} inputFolder - The input folder
   * @param {String} filename - The filename
   * @return {void}
   * @memberof CSV
   */
  processFile(inputFolder, filename) {
    const file = `${inputFolder}${filename}`
    const { points, CSV: parameters } = this.equipment
    const { timeColumn, hasFirstLine, archiveFolder, errorFolder } = parameters
    const readStream = fs.createReadStream(file)
    readStream.on('error', (err) => {
      this.logger.error(err)
      fs.rename(`${inputFolder}${filename}`, `${errorFolder}${filename}`, (erro) => {
        if (erro) {
          this.logger.error(erro)
        }
      })
      this.logger.info('File move to ', `${errorFolder}${filename}`)
    })
    let timeColumnIndex
    let firstLine = []
    let lineNumber = 0
    const csvFile = csv()
      .on('data', (csvObjects) => {
        lineNumber += 1
        if (hasFirstLine) {
          // if this file has the first line to describe all the columns
          if (lineNumber === 1) {
            timeColumnIndex = typeof timeColumn === 'number' ? timeColumn : csvObjects.indexOf(timeColumn)
            firstLine = csvObjects
          } else {
            points.forEach((point) => {
              let typeColumn = {}
              if (typeof Object.values(point.CSV)[0] === 'number') {
                typeColumn = point.CSV
              } else {
                Object.keys(point.CSV).forEach((key) => {
                  typeColumn[key] = firstLine.indexOf(point.CSV[key])
                })
              }
              const data = {}
              Object.keys(typeColumn).forEach((key) => {
                data[key] = csvObjects[typeColumn[key]]
              })
              const timestamp = csvObjects[timeColumnIndex]
              this.engine.addValue({
                pointId: point.pointId,
                timestamp,
                data,
              })
            })
          }
        } else {
          // if this file CSV doesn't have the first line to describe the columns
          // In this case, the parameter 'timeColumn' is required to be a number
          points.forEach((point) => {
            // In this case, the parameter 'column' is absolument a number
            const typeColumn = point.CSV
            const data = {}
            Object.keys(typeColumn).forEach((key) => {
              data[key] = csvObjects[typeColumn[key]]
            })
            const timestamp = csvObjects[timeColumn]
            this.engine.addValue({
              pointId: point.pointId,
              timestamp,
              data,
            })
          })
        }
      })
      .on('end', () => {
        this.logger.info('File loading end.')
        fs.rename(`${inputFolder}${filename}`, `${archiveFolder}fichier.csv`, (erro) => {
          if (erro) {
            this.logger.error(erro)
          }
        })
        this.logger.info('File move succeeded!')
      })

    readStream.pipe(csvFile)
  }
}

module.exports = CSV
