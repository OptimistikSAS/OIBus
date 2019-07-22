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

/**
 * Validates points for duplicate pointId.
 * @param {object[]} points - Imported Points
 * @returns {string[]} - The result
 */
const getDuplicateIds = (points) => {
  const makeDuplicateArray = points.reduce((duplicateArray, point) => {
    duplicateArray[point.pointId] = point.pointId in duplicateArray ? duplicateArray[point.pointId] += 1 : 0
    return duplicateArray
  }, {})

  const duplicateEntries = points.filter((point) => makeDuplicateArray[point.pointId])
  return Array.from(new Set(duplicateEntries.map((point) => point.pointId)))
}

/**
 * Validates points for valid scan modes.
 * @param {object[]} points - Imported Points
 * @param {string[]} scanModes - The scan modes available
 * @returns {string[]} - The result
 */
const getInvalidScanModes = (points, scanModes) => {
  const scanModeNames = scanModes.map((scanMode) => scanMode.scanMode)
  const filteredPoints = points.filter((point) => !scanModeNames.includes(point.scanMode))
  return filteredPoints.map((point) => point.scanMode)
}

module.exports = {
  exportToCSV,
  importFromCSV,
  getDuplicateIds,
  getInvalidScanModes,
}
