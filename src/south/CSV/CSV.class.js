const fs = require('fs')
const jscsv = require('javascript-csv')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Load the csv file from the path to an object
 * @todo We may have to handle very large files that can't be read in one pass.
 * cf http://c2fo.io/fast-csv/index.html
 *
 *
 * @param {*} file
 * @param {*} separator
 * @returns the csv file (in memory)
 * @memberof CSV
 */
const loadFile = (file, separator) => {
  // const content = fs.readFileSync(file).toString()
  console.log(file)
  const readStream = fs.createReadStream('./tests/csv/input/fichier.txt')
  const content = readStream.read()
  console.log(content)
  readStream.on('error', (err) => {
    console.error(err)
  })

  readStream.on('open', (fd) => {
    console.log('FIle opened', fd)
  })

  readStream.on('ready', () => {
    console.log('File ready..')
  })

  readStream.on('data', (chunk) => {
    console.log('Reading datas:', chunk)
    const csv = jscsv.toArrays(chunk, { separator })
    return csv
  })
}

/**
 * Class CSV
 */
class CSV extends ProtocolHandler {
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
      if (err) {
        console.error(err)
        return
      }
      if (!files.length) console.warn(`The folder ${inputFolder} is empty.`)
      files.forEach((filename) => {
        const csvObjects = loadFile(`${inputFolder}${filename}`, separator)
        if (hasFirstLine) {
          // if this file has the first line to describe all the columns
          const timeColumnIndex = typeof timeColumn === 'number' ? timeColumn : csvObjects[0].indexOf(timeColumn)
          points.forEach((point) => {
            let typeColumn = {}
            if (typeof Object.values(point.CSV)[0] === 'number') {
              typeColumn = point.CSV
            } else {
              Object.keys(point.CSV).forEach((key) => {
                typeColumn[key] = csvObjects[0].indexOf(point.CSV[key])
              })
            }
            csvObjects.forEach((line, index) => {
              if (index !== 0) {
                // The first line consists of the titles
                const data = {}
                Object.keys(typeColumn).forEach((key) => {
                  data[key] = line[typeColumn[key]]
                })
                const timestamp = line[timeColumnIndex]
                // this.engine.addValue({
                //   pointId: point.pointId,
                //   timestamp,
                //   data,
                // })
              }
            })
          })
        } else {
          // if this file CSV doesn't have the first line to describe the columns
          // In this case, the parameter 'indexOfTimeStamp' is required to be a number
          points.forEach((point) => {
            // In this case, the parameter 'column' is absolument a number
            const typeColumn = point.CSV
            csvObjects.forEach((line) => {
              const data = {}

              Object.keys(typeColumn).forEach((key) => {
                data[key] = line[typeColumn[key]]
              })
              const timestamp = line[timeColumn]
              // this.engine.addValue({
              //   pointId: point.pointId,
              //   timestamp,
              //   data,
              // })
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
