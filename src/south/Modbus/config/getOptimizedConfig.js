/* istanbul ignore file */

/**
 * Retrieves a nested property from an object
 * @param {Object} obj - Object which contains the nested property
 * @param {String} nestedProp - Property to search inside the object, must be of format "property.nestedProperty"
 * @param {boolean} delProp - whether to delete the property once find or not
 * @return {*} value of the property
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

const findAddressesGroup = (object, address) => Object.keys(object).find((group) => {
  const rangeAddresses = group.split('-')
  const start = parseInt(rangeAddresses[0], 10)
  const end = parseInt(rangeAddresses[1], 10)
  return address >= start && address <= end
})

/**
 * Groups the data sources by addresses to optimize requests
 * @param {[ Object ]} array - Array of objects to group
 * @param {String} key - Key or nested key address to find it inside the objects
 * @param {int} groupSize - Number of address by group
 * @return {Object} Grouped object by addresses
 */
const groupAddresses = (array, key, groupSize) => {
  const sortedArray = array.sort((a, b) => {
    const strAddressA = findProperty(a, key, false) // String address A
    const strAddressB = findProperty(b, key, false) // String address B
    return parseInt(strAddressA, 16) - parseInt(strAddressB, 16)
  })
  return sortedArray.reduce((acc, obj) => {
    const strAddress = findProperty(obj, key, false)
    const addressValue = parseInt(strAddress, 16) // Decimal value of hexadecimal address
    const nearestLimit = Math.round(addressValue / 16) * 16 // Nearest address group limit
    const groupStart = addressValue <= nearestLimit ? nearestLimit - 16 : nearestLimit // First address of the group
    const end = Math.round((nearestLimit + groupSize) / 16) * 16 // Last address

    const groupName = findAddressesGroup(acc, addressValue) || `${groupStart}-${end}`
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(obj)
    return acc
  }, {})
}

/**
 * Gets the configuration file
 * @param {Object} points - The data source
 * @param {Array} addressGap - address Gap
 * @return {Object} The scan modes
 */
const optimizedConfig = (points, addressGap) => {
  const scanModes = groupBy(points, 'scanMode' /* , { dataSourceId } */)
  Object.keys(scanModes).forEach((scan) => {
    scanModes[scan] = groupBy(scanModes[scan], 'type')
    Object.keys(scanModes[scan]).forEach((type) => {
      scanModes[scan][type] = groupAddresses(scanModes[scan][type], 'address', addressGap[type])
    })
  })
  /*
  Object.keys(scanModes).forEach((scan) => {
    if (!acc[scan]) acc[scan] = {}
    acc[scan] = { ...acc[scan], ...scanModes[scan]

  }
  return acc
  */
  return scanModes
}

module.exports = optimizedConfig
