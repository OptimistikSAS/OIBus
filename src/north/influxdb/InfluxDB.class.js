const fetch = require('node-fetch')
const Application = require('../Application.class')

class InfluxDB extends Application {
  constructor(engine) {
    super(engine)
    this.currentObject = {}
  }

  onScan() {
    while (this.queue.info().length > 0) {
      this.currentObject = this.queue.dequeue()
      this.makeRequest()
    }
  }

  makeRequest() {
    const { /* data, */pointId, timestamp } = this.currentObject
    const nodes = {}
    // nodes.data = data
    nodes.timestamp = timestamp
    pointId
      .slice(1)
      .split('#')[0]
      .split('/')
      .forEach((node) => {
        const nodeId = node.replace(/[\w ]+\.([\w]+)/g, '$1')
        const nodeValue = node.replace(/([\w ]+)\.[\w]+/g, '$1')
        nodes[nodeId] = nodeValue
      })
    Object.entries(nodes).forEach(([nodeId, node]) => {
      nodes[nodeId] = node.replace(/ /g, '\\ ')
    })
    fetch(`http://localhost:8086/write?db=${nodes.base}`, {
      body: `zzz,timestamp=${nodes.timestamp},tank=${nodes.tank} value=10`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
