const { Readable } = require('stream')

const csv = require('fast-csv')

/**
 * Export points configuration to CSV.
 * @param {object[]} points - The points to export
 * @returns {Promise<*>} - The result
 */
const exportToCSV = async points => new Promise((resolve, reject) => {
  const options = {
    headers: true,
    delimiter: ';',
  }
  csv.writeToString(
    points,
    options,
    (error, data) => {
      if (error) {
        reject(error)
      } else {
        const stream = new Readable()
        stream.push(data)
        stream.push(null)
        resolve(stream)
      }
    },
  )
})

/**
 * Import points configuration from CSV.
 * @param {string} csvContent - The CSV content
 * @returns {object[]} - The points
 */
const importFromCSV = (csvContent) => {
  console.info(csvContent)
  return []
}

module.exports = {
  exportToCSV,
  importFromCSV,
}
