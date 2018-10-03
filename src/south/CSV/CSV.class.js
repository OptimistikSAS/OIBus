const fs = require('fs')
const jscsv = require('javascript-csv')
// const optimizedConfig = require('./config/optimizedConfig')
const Protocol = require('../Protocol.class')

/**
 * Load the csv file from the path to an object
 * @param {*} file
 * @param {*} separator
 * @returns
 * @memberof CSV
 */
const loadFile = (file, separator) => {
  const content = fs.readFileSync(file).toString()
  console.log('content :', content)
  const csv = jscsv.toArrays(content, { separator })
  return csv
}

/**
 * Class CSV
 */
class CSV extends Protocol {
  /**
   * @constructor for CSV
   * @param {String} configPath : path to the non-optimized configuration file
   * @param {Object} engine
   */
  constructor({ equipments }, engine) {
    super(engine)
    this.equipments = equipments
    this.startWord = 'CSV connected.'
  }

  connect() {
    console.log(this.startWord)
  }

  /**
   * read the csv file and rewrite it to another file in the folder archive
   * @return {void}
   */
  onScan() {
    this.equipments.forEach((equipment) => {
      const { points } = equipment
      const { inputFolder, separator, archiveFolder, errorFolder } = equipment.CSV
      // list files in the inputFolder and manage them.
      const exists = fs.existsSync(filename)
      if (exists) {
        console.log('Opening the file ', filename)
        const csvObjects = loadFile(filename, separator)
        // can be also a string such as "time" to find the column
        const indexOfTimeStamp = equipment.CSV.indexOfTimeStamp
        points.forEach((point) => {
          const column = typeof point.CSV.column === 'number' ? point.CSV.column : (indexOfColumn = line.indexOf(point.CSV.column))

          // In case that the type is number
          csvObjects.forEach((line, index) => {
            if (index !== 0) {
              // parameter!!!!
              const data = line[column]
              const timestamp = line[indexOfTimeStamp]
              this.engine.addValue({ pointId: point.pointId, timestamp, data })
            }
          })
        })
        fs.rename(filename, `${archiveFolder}fichier.csv`, (err) => {
          if (err) {
            fs.writeFile(`${errorFolder}error.txt`, err.toString())
            console.log(err)
            return
          }
          console.log('Rename complete!')
        })
      }
    })
  }
}
module.exports = CSV
