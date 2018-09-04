const fetch = require('node-fetch')
const { sprintf } = require('sprintf-js')
const Application = require('../Application.class')


/**
 * Reads a string in pointId format and returns an object with corresponding indexes and values.
 * @param {String} pointId : string with this form : value1.name1/value2.name2#value
 * @return {Object} attributes : values indexed by name
 */
const pointIdToNodes = (pointId) => {
  const attributes = {}
  pointId
    .slice(1)
    .split('#')[0]
    .split('/')
    .forEach((node) => {
      const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1')
      const nodeValue = node.replace(/([\w ]+)\.[\w]+/g, '$1')
      attributes[nodeId] = nodeValue
    })
  return attributes
}

class InfluxDB extends Application {
  /**
   * @constructor for InfluxDB
   * @param {Object} engine
   */
  constructor(engine, applicationParameters) {
    super(engine, applicationParameters)
    this.host = applicationParameters.InfluxDB.host
    this.currentObject = {}
  }

  /**
   * Makes a request for every entry in the queue while emptying it.
   * @return {void}
   */
  onScan() {
    // this.queue.flush(value => this.makeRequest(value))
    while (this.queue.length > 0) {
      this.makeRequest(this.queue.dequeue())
    }
  }

  /**
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object} entry : the entry from the queue
   * @return {void}
   * @todo comment the regular expressions
   */
  makeRequest(entry) {
    const { data, pointId, timestamp } = entry
    const nodes = { data, host: this.host, timestamp }
    Object.entries(pointIdToNodes(pointId)).forEach(([nodeId, node]) => {
      nodes[nodeId] = node
    })
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (nodeId !== 'data') {
        nodes[nodeId] = node.replace(/ /g, '\\ ')
        if (!Number.isNaN(parseInt(node, 10))) nodes.measurement = nodeId
      }
    })
    const insert = global.fTbusConfig.applications[1].InfluxDB.insert.replace(/'/g, '')
    const body = sprintf((`${insert.split(' ')[2]} ${insert.split(' ')[3]}`)
      .replace(/xxx/g, 'timestamp')
      .replace(/yyy(tag)?/g, 'tank')
      .replace(/zzz/g, '%(measurement)s')
      .replace(/( \w+=).*/g, '$1%(data)s'), nodes)
    fetch(sprintf(`http://${insert.split(' ')[0]}`, nodes), {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
