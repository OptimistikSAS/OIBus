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
 * @return {Object} Grouped objects
 */
const groupBy = (array, key) => array.reduce((acc, obj) => {
  const myNewObj = { ...obj }
  const group = findProperty(myNewObj, key, true)
  if (!acc[group]) acc[group] = []
  acc[group].push({ ...myNewObj })
  return acc
}, {})

const findAddressesGroup = (object, address) => Object.keys(object)
  .find((group) => {
    const rangeAddresses = group.split('-')
    const start = parseInt(rangeAddresses[0], 10)
    const end = parseInt(rangeAddresses[1], 10)
    return address >= start && address <= end
  })

/**
 * Return the modbusType and deduce the register address
 * @param {string} addr - the address in decimal
 * @param {Object} logger - the logger to display errors
 * @returns {{address: number, modbusType: string, type: string}} - The computed address for this modbusType
 */
const getModbusType = (addr, logger) => {
  const addrValue = parseInt(addr, 16)
  if (addr.length < 6) {
    // coil = [0x00001 - 0x09999 (=39321)]
    if (addrValue <= 0x09999) {
      return {
        modbusType: 'coil',
        address: addrValue, // the addr does not need to be change
        type: 'boolean',
      }
    }
    // discreteInput = [0x10001 (=65537) - 0x19999 (=104857)]
    if (addrValue >= 0x10001 && addrValue <= 0x19999) {
      return {
        modbusType: 'discreteInput',
        address: addrValue - 0x10000, // need to remove the address of discreteInput register to keep the value address only
        type: 'number',
      }
    }
    // inputRegister = [0x30001 (=196609) - 0x39999 (=235929)]
    if (addrValue >= 0x30001 && addrValue <= 0x39999) {
      return {
        modbusType: 'inputRegister',
        address: addrValue - 0x30000, // need to remove the address of inputRegister register to keep the value address only
        type: 'number',
      }
    }
    // holdingRegister = [0x40001 (=262145) - 0x49999 (=301465)]
    if (addrValue >= 0x40001 && addrValue <= 0x49999) {
      return {
        modbusType: 'holdingRegister',
        address: addrValue - 0x40000, // need to remove the address of holdingRegister register to keep the value address only
        type: 'number',
      }
    }
  } else if (addr.length === 6) {
    // coil = [0x000001 - 0x065535]
    if (addrValue <= 0x065535) {
      return {
        modbusType: 'coil',
        address: addrValue, // the addr does not need to be change
        type: 'boolean',
      }
    }
    // discreteInput = [0x100001 - 0x165535]
    if (addrValue >= 0x100001 && addrValue <= 0x165535) {
      return {
        modbusType: 'discreteInput',
        address: addrValue - 0x100000, // need to remove the address of discreteInput register to keep the value address only
        type: 'number',
      }
    }
    // inputRegister = [0x300001 - 0x365535]
    if (addrValue >= 0x300001 && addrValue <= 0x365535) {
      return {
        modbusType: 'inputRegister',
        address: addrValue - 0x300000, // need to remove the address of inputRegister register to keep the value address only
        type: 'number',
      }
    }
    // holdingRegister = [0x400001 - 0x465535]
    if (addrValue >= 0x400001 && addrValue <= 0x465535) {
      return {
        modbusType: 'holdingRegister',
        address: addrValue - 0x400000, // need to remove the address of holdingRegister register to keep the value address only
        type: 'number',
      }
    }
  }

  logger.error(`The address ${addr} (HEX : ${addr.toString(16)}) was not recognized.`)
  // return invalid modbusType and address to trigger an error
  return {
    modbusType: 'unknown',
    address: 999999,
    type: 'unknown',
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
    return parseInt(strAddressA, 10) - parseInt(strAddressB, 10)
  })

  return sortedArray.reduce((acc, obj) => {
    const strAddress = findProperty(obj, key, false)
    const addressValue = parseInt(strAddress, 10)
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
        const { modbusType, address, type } = getModbusType(myPoint.address, logger)
        return {
          ...myPoint,
          modbusType,
          address,
          type,
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

module.exports = { getOptimizedScanModes }
