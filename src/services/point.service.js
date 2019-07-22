const csv = require('fast-csv')

/**
 * Export points configuration to CSV.
 * @param {object[]} points - The points to export
 * @returns {Promise<*>} - The result
 */
const exportToCSV = (points) => {
  const options = { headers: true }
  return csv.writeToString(points, options)
}

/**
 * Import points configuration from CSV.
 * @param {string} csvContent - The CSV content
 * @returns {Promise<*>} - The result
 */
const importFromCSV = async (csvContent) => new Promise((resolve) => {
  const points = []
  const options = {
    headers: true,
    strictColumnHandling: true,
  }
  csv
    .parseString(csvContent, options)
    .on('data', (csvObjects) => {
      points.push(csvObjects)
    })
    .on('end', () => {
      resolve(points)
    })
})

module.exports = {
  exportToCSV,
  importFromCSV,
}
