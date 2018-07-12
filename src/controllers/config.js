const fs = require('fs')
const configService = require('../services/config.service')

/**
 * Retreives a nested property from an object
 * @param {Object} obj : objectwhich contains the nested property
 * @param {String} nestedProp : property to search inside the object, must be of format "property.nestedProperty"
 * @return {*} : value of the property
 */
const getNestedProperty = (obj, nestedProp) => {
  const propArray = nestedProp.split('.')
  const currentProp = propArray.splice(0, 1)[0]
  if (propArray.length !== 0) {
    return getNestedProperty(obj[currentProp], propArray.join('.'))
  }
  return obj[currentProp]
}

/**
 * Groups objects based on a mutual property
 * @param {[ Object ]} array : array of objects to group
 * @param {String} key : name of the property on which base the groups
 * @return {Object} acc : grouped objects
 */
const groupBy = (array, key) => {
  const nestedKey = key.includes('.')
  return array.reduce((acc, obj) => {
    const group = nestedKey ? getNestedProperty(obj, key) : obj[key]
    if (!acc[group]) acc[group] = []
    acc[group].push(obj)
    return acc
  }, {})
}

/**
 * Gets the configuration file
 * @param {Object} ctx : koa context
 * @return {void}
 */
const getConfig = (ctx) => {
  const args = configService.parseArgs()

  // Check if the arguments are not null or undefined
  if (!args) {
    console.error('Args validity check failed!')
    return false
  }

  const { config } = args // Get the configuration file path

  // Check if the provided file is json
  if (!config.endsWith('.json')) {
    console.error('You must provide a json file for the configuration!')
    return false
  }

  const configFile = JSON.parse(fs.readFileSync(config, 'utf8')) // Read configuration file synchronously

  if (!configFile) {
    console.error(`The file ${config} could not be loaded!`)
    return false
  }

  // Browse elements of the file
  const groups = configFile.map((equipment) => {
    const { equipmentId, protocol, variables } = equipment
    const frqGroups = groupBy(variables, 'scanMode', protocol)
    Object.keys(frqGroups).forEach((freq) => {
      const value = frqGroups[freq]
      frqGroups[freq] = groupBy(value, `${protocol}.type`)
    })
    return { equipmentId, protocol, frqGroups }
  })

  ctx.ok(groups)

  return true
}

module.exports = { getConfig }
