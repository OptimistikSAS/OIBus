const fs = require('fs')
const jscsv = require('javascript-csv')
const Protocol = require('../ProtocolHandler.class')

/**
 * Load the csv file from the path to an object
 * @todo We may have to handle very large files that can't be read in one pass.
 * @param {*} file
 * @param {*} separator
 * @returns
 * @memberof CSV
 */
const loadFile = (file, separator) => {
  const content = fs.readFileSync(file).toString()
  const csv = jscsv.toArrays(content, { separator })
  return csv
}

/**
 * Class CSV
 */
class CSV extends Protocol {
  /**
   * read the csv file and rewrite it to another file in the folder archive
   * @return {void}
   */
  onScan(scanMode) {
    const { points, defaultScanMode, CSV: parameters } = this.equipment
    if (scanMode !== defaultScanMode) return
    const { inputFolder, archiveFolder, errorFolder, timeColumn, hasFirstLine, separator } = parameters
    // list files in the inputFolder and manage them.
    fs.readdir(inputFolder, (err, files) => {
      /** @todo should we check why we have err  */
      if (err) return
      if (!files.length) console.warn(`The folder ${inputFolder} is empty.`)
      files.forEach((filename) => {
        const csvObjects = loadFile(`${inputFolder}${filename}`, separator)
        // can be also a string such as "time" to find the column
        if (hasFirstLine) {
          // if this file CSV has the first line to describe all the columns
          const timeColumnIndex = typeof timeColumn === 'number' ? timeColumn : csvObjects[0].indexOf(timeColumn)
          points.forEach((point) => {
            const column = typeof point.CSV.column === 'number' ? point.CSV.column : csvObjects[0].indexOf(point.CSV.column)

            // In case that the type is number
            csvObjects.forEach((line, index) => {
              if (index !== 0) {
                // The first line consists of the titles
                const data = line[column]
                const timestamp = line[timeColumnIndex]
                this.engine.addValue({ pointId: point.pointId, timestamp, data })
              }
            })
          })
        } else {
          // if this file CSV doesn't have the first line to describe the columns
          // In this case, the parameter 'indexOfTimeStamp' require to be a number
          points.forEach((point) => {
            // In this case, the parameter 'column' is absolument a number
            const { column } = point.CSV
            csvObjects.forEach((line) => {
              const data = line[column]
              const timestamp = line[timeColumn]
              this.engine.addValue({ pointId: point.pointId, timestamp, data })
            })
          })
        }
        fs.rename(`${inputFolder}${filename}`, `${archiveFolder}fichier.csv`, (erro) => {
          if (erro) {
            fs.writeFile(`${errorFolder}error.txt`, erro.toString())
            return
          }
          console.info('Rename complete!')
        })
      })
    })
  }
}
module.exports = CSV
