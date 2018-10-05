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
      fs.readdir(inputFolder, (err, files) => {
        if (err) return
        if (!files.length) console.log('The folder ', inputFolder, ' is empty.')
        files.forEach((filename) => {
          console.log('Opening the file ', filename)
          const csvObjects = loadFile(`${inputFolder}${filename}`, separator)
          // can be also a string such as "time" to find the column
          if (equipment.hasFirstLine) {
            // if this file CSV has the first line to describe all the columns
            const indexOfTimeStamp = typeof equipment.CSV.indexOfTimeStamp === 'number'
              ? equipment.CSV.indexOfTimeStamp
              : csvObjects[0].indexOf(equipment.CSV.indexOfTimeStamp)
            points.forEach((point) => {
              const column = typeof point.CSV.column === 'number' ? point.CSV.column : csvObjects[0].indexOf(point.CSV.column)

              // In case that the type is number
              csvObjects.forEach((line, index) => {
                if (index !== 0) {
                  // The first line consists of the titles
                  const data = line[column]
                  const timestamp = line[indexOfTimeStamp]
                  this.engine.addValue({ pointId: point.pointId, timestamp, data })
                }
              })
            })
          } else {
            // if this file CSV doesn't have the first line to describe the columns
            // In this case, the parameter 'indexOfTimeStamp' is absolument a number
            const { indexOfTimeStamp } = equipment.CSV
            points.forEach((point) => {
              // In this case, the parameter 'column' is absolument a number
              const { column } = point.CSV
              csvObjects.forEach((line) => {
                const data = line[column]
                const timestamp = line[indexOfTimeStamp]
                this.engine.addValue({ pointId: point.pointId, timestamp, data })
              })
            })
          }
          fs.rename(`${inputFolder}${filename}`, `${archiveFolder}fichier.csv`, (erro) => {
            if (erro) {
              fs.writeFile(`${errorFolder}error.txt`, erro.toString())
              console.log(erro)
              return
            }
            console.log('Rename complete!')
          })
        })
      })
    })
  }
}
module.exports = CSV
