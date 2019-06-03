const csv = require('fast-csv')

/**
 * Export points configuration to CSV.
 * @param {object[]} points - The points to export
 * @returns {Promise<*>} - The result
 */
const exportToCSV = async points => new Promise((resolve, reject) => {
  csv.writeToString(
    points,
    { headers: true },
    (error, data) => {
      if (error) {
        reject(error)
      } else {
        console.info(data)
        resolve(data)
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
