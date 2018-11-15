const fetch = require('node-fetch')
const { sprintf } = require('sprintf-js')
const ApiHandler = require('../ApiHandler.class')

/**
 * Reads a string in pointId format and returns an object with corresponding indexes and values.
 * @param {String} pointId : string with this form : value1.name1/value2.name2#value
 * @return {Object} attributes : values indexed by name
 */
const pointIdToNodes = (attributes, pointId) => {
  pointId
    .slice(1)
    .split('/')
    .forEach((node) => {
      const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1') // Extracts the word after the dot
      const nodeValue = node.replace(/([\w ]+)\.[\w]+/g, '$1') // Extracts the one before
      attributes[nodeId] = nodeValue
    })
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
    const { pointId } = entry
    console.log(entry)
    const nodes = { host: this.host }
    Object.entries(entry).forEach(([id, prop]) => {
      if (id !== 'pointId') {
        nodes[id] = prop
      }
    })
    pointIdToNodes(nodes, pointId)
    console.log(nodes.dataId)
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (nodeId !== nodes.dataId) {
        console.log(node, nodeId)
        nodes[nodeId] = node.replace(/ /g, '\\ ')
        if (!Number.isNaN(parseInt(node, 10))) nodes.measurement = nodeId
      }
    })
    const insert = this.applicationParameters.InfluxDB.insert.replace(/'/g, '')
    let body = `${insert.split(' ')[2]} ${insert.split(' ')[3]}`
      .replace(/zzz/g, '%(measurement)s') // // Use types from config ??
      .replace(/ \w+=.*/g, ' %(dataId)s=') // Looks for the last field (value field) and inserts the data
    body = `${body}%(${nodes.dataId})s`
    Object.keys(nodes).forEach((nodeId) => {
      const notTags = ['data', 'host', 'measurement', nodes.measurement, 'base']
      if (!notTags.includes(nodeId)) {
        // Replaces 3-same-letter fields by a tagName
        // i.e : Transforms xxx=%(xxx) into tagName=%(tagName)
        body = body.replace(/([a-z])\1\1(tag)?=%\(\1\1\1\)/, `${nodeId}=%(${nodeId})`)
      }
    })
    // Removes any unused 'xxx=%(xxx)' field from body
    body = body.replace(/,([a-z])\1\1(tag)?=%\(\1\1\1\)/g, '')
    body = sprintf(body, nodes)
    fetch(sprintf(`http://${insert.split(' ')[0]}`, nodes), {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
