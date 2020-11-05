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

const findAddressesGroup = (object, address) => Object.keys(object)
  .find((group) => {
    const rangeAddresses = group.split('-')
    const start = parseInt(rangeAddresses[0], 10)
    const end = parseInt(rangeAddresses[1], 10)
    return address >= start && address <= end
  })

const parseAddr = (addr) => {
  if (typeof addr === 'string' && addr.startsWith('0x')) {
    return parseInt(addr, 16)
  }
  return parseInt(addr, 10)
}

/**
 * Return the modbusType and deduce the register address
 * @param {number} addr - the address in decimal
 * @param {Object} logger - the logger to display errors
 * @returns {{address: number, modbusType: string}} - The computed address for this modbusType
 */
const getModbusType = (addr, logger) => {
  // coil = [0x00001 - 0x09999 (=39321)]
  if (addr < 39321) {
    return {
      modbusType: 'coil',
      address: addr, // the addr does not neet to be change
    }
  }
  // discreteInput = [0x10001 (=65537) - 0x19999 (=104857)]
  if (addr > 65536 && addr <= 104857) {
    return {
      modbusType: 'discreteInput',
      address: addr - 65536, // need to remove the address of discreteInput register to keep the value address only
    }
  }
  // inputRegister = [0x30001 (=196609) - 0x39999 (=235929)]
  if (addr > 196608 && addr <= 235929) {
    return {
      modbusType: 'inputRegister',
      address: addr - 196608, // need to remove the address of inputRegister register to keep the value address only
    }
  }
  // holdingRegister = [0x40001 (=262145) - 0x49999 (=301465)]
  if (addr > 262144 && addr <= 301465) {
    return {
      modbusType: 'holdingRegister',
      address: addr - 262144, // need to remove the address of holdingRegister register to keep the value address only
    }
  }

  logger.error(`The address ${addr} (HEX : ${addr.toString(16)}) was not recognized.`)
  // return invalid modbusType and address to trigger an error
  return {
    modbusType: 'unknown',
    address: 999999,
  }
}

/**
 * Groups the data sources by addresses to optimize requests
 * @param {[ Object ]} array - Array of objects to group
 * @param {String} key - Key or nested key address to find it inside the objects
 * @param {int} maxGroupSize - Maximum number of addresses by group
 * @return {Object} Grouped object by addresses
 */
const groupAddresses = (array, key, maxGroupSize) => {
  const sortedArray = array.sort((a, b) => {
    const strAddressA = findProperty(a, key, false) // String address A
    const strAddressB = findProperty(b, key, false) // String address B
    return parseAddr(strAddressA) - parseAddr(strAddressB)
  })

  return sortedArray.reduce((acc, obj) => {
    const strAddress = findProperty(obj, key, false)
    const addressValue = parseAddr(strAddress)
    const nearestLimit = Math.round(addressValue / 16) * 16 // Nearest address group limit
    const groupStart = addressValue <= nearestLimit ? nearestLimit - 16 : nearestLimit // First address of the group
    const end = Math.round((nearestLimit + maxGroupSize) / 16) * 16 // Last address

    const groupName = findAddressesGroup(acc, addressValue) || `${groupStart}-${end}`
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(obj)
    return acc
  }, {})
}

/**
 * Gets the configuration file
 * @param {Array} points - The list of points to request with ModBus
 * @param {Object} logger - The logger to display errors
 * @return {Object} The scan modes
 */
const getOptimizedScanModes = (points, logger) => {
  const scanModes = groupBy(points, 'scanMode')
  Object.keys(scanModes)
    .forEach((scanMode) => {
      // add modbusType and register address to each point
      scanModes[scanMode] = scanModes[scanMode].map((myPoint) => {
        const { modbusType, address } = getModbusType(parseAddr(myPoint.address), logger)
        return {
          ...myPoint,
          modbusType,
          address,
        }
      })
      scanModes[scanMode] = groupBy(scanModes[scanMode], 'modbusType')
      Object.keys(scanModes[scanMode])
        .forEach((type) => {
          scanModes[scanMode][type] = groupAddresses(scanModes[scanMode][type], 'address', 16)
        })
    })
  return scanModes
}

module.exports = {
  getOptimizedScanModes,
  parseAddr,
}
