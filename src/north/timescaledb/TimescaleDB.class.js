const pg = require('pg')

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

class TimescaleDB extends ApiHandler {
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
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
   * Makes a TimescaleDB request with the parameters in the Object arg.
   * @param {Object} entry - The entry from the event
   * @return {void}
   */
  makeRequest(entry) {
    const { host, user, password, db } = this.application.TimescaleDB
    const { pointId, data, timestamp } = entry
    // Convert the pointId into nodes
    const Nodes = Object.entries(pointIdToNodes(pointId))
    // Build the url
    const url = `postgres://${user}:${password}@${host}/${db}`
    // Get client object and connect to the database
    this.client = new pg.Client(url)
    this.client.connect((err) => {
      if (err) {
        return this.logger.error('could not connect to postgres', err)
      }
      return 0
    })
    // Make the query by rebuilding the Nodes
    const tableName = Nodes[Nodes.length - 1][0]
    let query = `insert into ${tableName}(`
    const values = []
    let fields = null
    const num = []
    let count = 0
    Nodes.slice(1).forEach(([nodeKey, nodeValue]) => {
      count += 1
      if (!fields) fields = `${escapeSpace(nodeKey)}`
      else fields = `${fields},${escapeSpace(nodeKey)}`
      values.push(nodeValue)
      num.push(`$${count}`)
    })
    // Converts data into fields for CLI
    // The data received from MQTT is type of string, so we need to transform it to Json
    const dataJson = JSON.parse(data)
    Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
      count += 1
      if (!fields) fields = `${escapeSpace(fieldKey)}`
      else fields = `${fields},${escapeSpace(fieldKey)}`
      values.push(fieldValue)
      num.push(`$${count}`)
    })
    fields += ',timestamp'
    num.push(`$${count + 1}`)
    values.push(timestamp)
    query += `${fields}) values(${num.join(',')})`
    this.sendRequest(query, values, () => {})
  }

  /**
   * Send the request.
   * @param {String} str - The query
   * @param {Array} value - The values
   * @param {Function} callback - The callback
   * @return {void}
   */
  sendRequest(str, value, callback) {
    this.client.query(str, value, (err, result) => {
      if (err) {
        this.logger.error(err)
      } else if (result.rows !== undefined) callback(result.rows)
      else callback()
    })
  }
}

module.exports = TimescaleDB
