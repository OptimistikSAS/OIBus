/**
 * Retrieves a nested property from an object
 * @param {Object} obj - Object which contains the nested property
 * @param {String} nestedProp - Property to search inside the object, must be of format "property.nestedProperty"
 * @param {boolean} delProp - Whether to delete the property once find or not
 * @return {*} Value of the property
 */
const findProperty = (obj, nestedProp, delProp) => {
  const propArray = nestedProp.split('.')
  const currentProp = propArray.splice(0, 1)[0]
  if (propArray.length !== 0) {
    return findProperty(obj[currentProp], propArray.join('.'), delProp)
  }
  const res = obj[currentProp]
  if (delProp) delete obj[currentProp] // Delete useless property
  return res
}

/**
 * Groups objects based on a mutual property
 * @param {[ Object ]} array - Array of objects to group
 * @param {String} key - Name of the property on which base the groups
 * @param {Object} newProps - The new props
 * @return {Object} Grouped objects
 */
const groupBy = (array, key, newProps = {}) => array.reduce((acc, obj) => {
  const group = findProperty(obj, key, true)
  if (!acc[group]) acc[group] = []
  acc[group].push({ ...obj, ...newProps })
  return acc
}, {})

/**
 * Get optimized config.
 * @param {Object} dataSource - The data source
 * @return {*} The optimized config
 */
const getOptimizedConfig = (dataSource) => groupBy(dataSource.points, 'scanMode')
// {
// const optimized = dataSource.reduce((acc, { dataSourceId, protocol, points }) => {
// const scanModes = groupBy(dataSource.points, 'scanMode')
// Object.keys(scanModes).forEach((scan) => {
//   console.log(scan)
//   console.log(scanModes[scan])
//   console.log(groupBy(scanModes[scan], 'dataSourceId'))
//   console.log(scanModes[scan])
//   scanModes[scan] = groupBy(scanModes[scan], 'dataSourceId')
// })
// Object.keys(scanModes).forEach((scan) => {
//   if (!acc[scan]) acc[scan] = {}
//   acc[scan] = { ...acc[scan], ...scanModes[scan] }
// })
// return groupBy(dataSource.points, 'scanMode')
// }, {})
// return optimized
// }

module.exports = getOptimizedConfig
