const fetch = require('node-fetch')
const { sprintf } = require('sprintf-js')
const Application = require('../Application.class')

const pointIdToNodes = (pointId) => {
  const attributes = {}
  pointId
    .slice(1)
    .split('#')[0]
    .split('/') // Split to treat every tag.tagvalue element out of the pointId
    .forEach((node) => {
      const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1') // This regex extracts the part after the dot
      const nodeValue = node.replace(/([\w ]+)\.[\w]+/g, '$1') // This regex extracts the part before the dot
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
    console.log(nodes)
    const insert = global.fTbusConfig.applications[1].InfluxDB.insert.replace(/'/g,'')
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
