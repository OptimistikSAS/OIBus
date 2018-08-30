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
  constructor(engine) {
    super(engine)
    this.host = 'localhost:8086'
    this.currentObject = {}
  }

  onScan() {
    while (this.queue.info().length > 0) {
      this.currentObject = this.queue.dequeue()
      this.makeRequest()
    }
  }

  makeRequest() {
    const { data, pointId, timestamp } = this.currentObject
    const nodes = {}
    nodes.data = data
    nodes.host = this.host
    nodes.timestamp = timestamp
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
