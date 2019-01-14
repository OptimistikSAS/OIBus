const fetch = require('node-fetch')
const ApiHandler = require('../ApiHandler.class')

/**
 * Reads a string in pointId format and returns an object with corresponding indexes and values.
 * @param {String} pointId - String with this form : value1.name1/value2.name2#value
 * @return {Object} Values indexed by name
 */
const pointIdToNodes = (pointId) => {
  const attributes = {}
  pointId
    .slice(1)
    .split('/')
    .forEach((node) => {
      const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1') // Extracts the word after the dot
      attributes[nodeId] = node.replace(/([\w ]+)\.[\w]+/g, '$1') // Extracts the one before
    })
  return attributes
}

/**
 * Escape spaces.
 * @param {*} chars - The content to escape
 * @return {*} The escaped or the original content
 */
const escapeSpace = (chars) => {
  if (typeof chars === 'string') {
    return chars.replace(/ /g, '\\ ')
  }
  return chars
}

/**
 * Class InfluxDB - generates and sends InfluxDB requests
 */
class InfluxDB extends ApiHandler {
  /**
   * Constructor for InfluxDB
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.host = applicationParameters.InfluxDB.host
    this.currentObject = {}
  }

  /**
   * Makes a request for every entry received from the event.
   * @param {Object[]} values - The values
   * @return {void}
   */
  onUpdate(values) {
    this.makeRequest(values)
  }

  /**
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {void}
   */
  makeRequest(entries) {
    const { host, user, password, db } = this.application.InfluxDB
    const url = `http://${host}/write?u=${user}&p=${password}&db=${db}`

    let body = ''

    entries.forEach((entry) => {
      const { pointId, data, timestamp } = entry
      const Nodes = Object.entries(pointIdToNodes(pointId))
      const measurement = Nodes[Nodes.length - 1][0]

      // Convert nodes into tags for CLI
      let tags = null
      Nodes.slice(1).forEach(([tagKey, tagValue]) => {
        if (!tags) tags = `${escapeSpace(tagKey)}=${escapeSpace(tagValue)}`
        else tags = `${tags},${escapeSpace(tagKey)}=${escapeSpace(tagValue)}`
      })

      // Converts data into fields for CLI
      let fields = null
      // The data received from MQTT is type of string, so we need to transform it to Json
      const dataJson = JSON.parse(data)
      Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
        if (!fields) fields = `${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
        else fields = `${fields},${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
      })

      // Append entry to body
      body += `${measurement},${tags} ${fields} ${1000 * 1000 * timestamp.getTime()}\n`
    })

    // Send data to InfluxDB
    fetch(url, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
