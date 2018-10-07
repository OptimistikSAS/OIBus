/**
 * Retrieves a nested property from an object
 * @param {Object} obj : objectwhich contains the nested property
 * @param {String} nestedProp : property to search inside the object, must be of format "property.nestedProperty"
 * @param {boolean} delProp : whether to delete the property once find or not
 * @return {*} : value of the property
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
 * @param {[ Object ]} array : array of objects to group
 * @param {String} key : name of the property on which base the groups
 * @return {Object} acc : grouped objects
 */
const groupBy = (array, key, newProps = {}) => array.reduce((acc, obj) => {
  const group = findProperty(obj, key, true)
  if (!acc[group]) acc[group] = []
  acc[group].push({ ...obj, ...newProps })
  return acc
}, {})

const getOptimizedConfig = (equipment) => {
  const optimized = equipment.reduce((acc, { equipmentId, protocol, points }) => {
    if (protocol === 'OPCUA') {
      const scanModes = groupBy(points, 'scanMode', { equipmentId })
      Object.keys(scanModes).forEach((scan) => {
        scanModes[scan] = groupBy(scanModes[scan], 'equipmentId')
        Object.values(scanModes[scan]).forEach((equipment) => {
          equipment.forEach((point) => {
            delete point.type
          })
        })
      })
      Object.keys(scanModes).forEach((scan) => {
        if (!acc[scan]) acc[scan] = {}
        acc[scan] = { ...acc[scan], ...scanModes[scan] }
      })
    }
    return acc
  }, {})
  return optimized
}

module.exports = optimizedConfig
