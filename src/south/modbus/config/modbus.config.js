const fs = require('fs')
const configService = require('../../../services/config.service')

/**
 * Retreives a nested property from an object
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
const groupBy = (array, key) =>
  array.reduce((acc, obj) => {
    const group = findProperty(obj, key, true)
    if (!acc[group]) acc[group] = []
    acc[group].push(obj)
    return acc
  }, {})

const findAddressesGroup = (object, address) =>
  Object.keys(object).find((group) => {
    const rangeAddresses = group.split('-')
    const start = parseInt(rangeAddresses[0], 10)
    const end = parseInt(rangeAddresses[1], 10)
    return address >= start && address <= end
  })

/**
 * Groups the equipments by addresses to optimize requests
 * @param {[ Object ]} array : array of objects to group
 * @param {String} key : key or nested key address to find it inside the objects
 * @param {int} groupSize : number of address by group
 * @return {Object} acc : grouped object by addresses
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
 * @return {boolean}
 */
const getConfig = () => {
  const args = configService.parseArgs() || {}
  const { configPath = './fTbus.config.json' } = args // Get the configuration file path

  // Check if the provided file is json
  if (!configPath.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return false
  }

  const fTbusConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) // Read fTbus config file
  const { configExemple } = fTbusConfig
  const configFile = JSON.parse(fs.readFileSync(configExemple, 'utf8')) // Read configuration file synchronously

  if (!configFile) {
    console.error(`The file ${configExemple} could not be loaded!`)
    return false
  }

  // Browse elements of the file
  const groups = configFile.map((equipment) => {
    const { equipmentId, protocol, variables } = equipment
    const protocolConfig = JSON.parse(fs.readFileSync(`./tests/${protocol}.config.json`, 'utf8')) // Read configuration file synchronously
    const { addressesGroupsSize } = protocolConfig
    const variableGroups = groupBy(variables, 'scanMode') // Group equipments by frequence

    // Grouping the equipments on multiple level
    Object.keys(variableGroups).forEach((freq) => {
      variableGroups[freq] = groupBy(variableGroups[freq], `${protocol}.type`) // Group equipments by type

      // Making groups of address ranges
      Object.keys(variableGroups[freq]).forEach((type) => {
        variableGroups[freq][type] = groupAddresses(variableGroups[freq][type], `${protocol}.address`, addressesGroupsSize)
      })
    })
    return { equipmentId, protocol, variableGroups }
  })

  //   fs.writeFile('./tests/optimizedConfig.json', JSON.stringify(groups), 'utf8', () => {
  //     console.info('Optimized config file has been generated.')
  //   })

  return groups
}

module.exports = getConfig
