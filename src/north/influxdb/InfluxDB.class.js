const fetch = require('node-fetch')
const ApiHandler = require('../ApiHandler.class')

/**
 * Reads a string in pointId format and returns an object with corresponding indexes and values.
 * @param {String} pointId : string with this form : value1.name1/value2.name2#value
 * @return {Object} attributes : values indexed by name
 */
const pointIdToNodes = (pointId) => {
  const attributes = {}
  pointId
    .slice(1)
    .split('/')
    .forEach((node) => {
      const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1') // Extracts the word after the dot
      const nodeValue = node.replace(/([\w ]+)\.[\w]+/g, '$1') // Extracts the one before
      attributes[nodeId] = nodeValue
    })
  return attributes
}

const escapeSpace = (chars) => {
  if (typeof chars === 'string') {
    const charsEscaped = chars.replace(/ /g, '\\ ')
    return charsEscaped
  }
  return chars
}

/**
 * Class InfluxDB : generates and sends InfluxDB requests
 */
class InfluxDB extends ApiHandler {
  /**
   * @constructor for InfluxDB
   * @param {Object} engine
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.host = applicationParameters.InfluxDB.host
    this.currentObject = {}
    this.start()
  }

  /**
   * Makes a request for every entry revceived from the event.
   * @return {void}
   */
  onUpdate(value) {
    this.makeRequest(value)
  }

  /**
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object} entry : the entry from the event
   * @return {void}
   */
  makeRequest(entry) {
    const { host, user, password } = this.application.InfluxDB
    const { pointId, data, timestamp } = entry
    const Nodes = Object.entries(pointIdToNodes(pointId))
    const db = Nodes[0][1]
    const measurement = Nodes[Nodes.length - 1][0]
    const url = `http://${host}/write?u=${user}&p=${password}&db=${db}`
    // Convert nodes into tags for CLI
    let tags
    Nodes.slice(1).forEach(([tagKey, tagValue]) => {
      if (!tags) tags = `${escapeSpace(tagKey)}=${escapeSpace(tagValue)}`
      else tags = `${tags},${escapeSpace(tagKey)}=${escapeSpace(tagValue)}`
    })
    // Converts data into fields for CLI
    let fields
    // The data received from MQTT is type of string, so we need to transform is to Json
    const dataJson = JSON.parse(data)
    Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
      if (!fields) fields = `${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
      else fields = `${fields},${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
    })
    const body = `${measurement},${tags} ${fields} ${timestamp.getTime()}`
    fetch(url, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
