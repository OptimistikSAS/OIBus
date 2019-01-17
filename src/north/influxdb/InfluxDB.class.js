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
   * @param {Object} value - The value
   * @return {void}
   */
  onUpdate(value) {
    this.makeRequest(value)
  }

  /**
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object} entry - The entry from the event
   * @return {void}
   */
  makeRequest(entry) {
    const { host, user, password, db } = this.application.InfluxDB
    const { pointId, data, timestamp } = entry
    const Nodes = Object.entries(pointIdToNodes(pointId))
    const measurement = Nodes[Nodes.length - 1][0]
    const url = `http://${host}/write?u=${user}&p=${password}&db=${db}`
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
    // If not specified otherwise, timestamp must be in nanosecond
    const body = `${measurement},${tags} ${fields} ${1000 * 1000 * timestamp.getTime()}`
    fetch(url, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
