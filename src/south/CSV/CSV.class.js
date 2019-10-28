const fs = require('fs')
const csv = require('fast-csv')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class CSV.
 * @todo: Warning: this protocol needs rework to be production ready.
 */
class CSV extends ProtocolHandler {
  /**
   * Read the csv file and rewrite it to another file in the folder archive
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  onScan(_scanMode) {
    const { inputFolder } = this.dataSource.CSV

    // list files in the inputFolder and manage them.
    fs.readdir(inputFolder, (error, files) => {
      if (error) {
        this.logger.error(error)
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
    const { points, timeColumn, hasFirstLine, archiveFolder, errorFolder } = this.dataSource.CSV
    const readStream = fs.createReadStream(file)
    readStream.on('error', (readError) => {
      this.logger.error(readError)
      fs.rename(`${inputFolder}${filename}`, `${errorFolder}${filename}`, (renameError) => {
        if (renameError) {
          this.logger.error(renameError)
        }
      })
      this.logger.info('File move to ', `${errorFolder}${filename}`)
    })
    let timeColumnIndex
    let firstLine = []
    let lineNumber = 0
    const csvFile = csv.parse()
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
              if (typeof point.value === 'number') {
                typeColumn = {
                  value: point.value,
                  quality: point.quality,
                }
              } else {
                typeColumn = {
                  value: firstLine.indexOf(point.value),
                  quality: firstLine.indexOf(point.quality),
                }
              }
              const data = {}
              Object.keys(typeColumn).forEach((key) => {
                data[key] = csvObjects[typeColumn[key]]
              })
              const timestamp = new Date(csvObjects[timeColumnIndex]).toISOString()
              /** @todo: below should send by batch instead of single points */
              this.addValues([
                {
                  pointId: point.pointId,
                  timestamp,
                  data: { value: JSON.stringify(data) },
                },
              ])
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
            const timestamp = new Date(csvObjects[timeColumn]).toISOString()
            /** @todo: below should send by batch instead of single points */
            this.addValues([
              {
                pointId: point.pointId,
                timestamp,
                data: { value: JSON.stringify(data) },
              },
            ])
          })
        }
      })
      .on('end', () => {
        this.logger.info('File loading end.')
        fs.rename(`${inputFolder}${filename}`, `${archiveFolder}fichier.csv`, (error) => {
          if (error) {
            this.logger.error(error)
          }
        })
        this.logger.info('File move succeeded!')
      })

    readStream.pipe(csvFile)
  }
}

module.exports = CSV
