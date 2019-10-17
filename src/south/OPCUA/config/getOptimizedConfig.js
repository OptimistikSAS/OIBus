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
module.exports = getOptimizedConfig
