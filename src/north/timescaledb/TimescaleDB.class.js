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
  /**
   * Constructor for TimescaleDB
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to InfluxDB.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  handleValues(values) {
    return this.makeRequest(values)
  }

  /**
   * Makes a TimescaleDB request with the parameters in the Object arg.
   * @param {object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  makeRequest(entries) {
    return new Promise((resolve, reject) => {
      const { host, user, password, db } = this.application.TimescaleDB
      // Build the url
      const url = `postgres://${user}:${this.decryptPassword(password)}@${host}/${db}`
      // Get client object and connect to the database
      this.client = new pg.Client(url)
      this.client.connect((error) => {
        if (error) {
          reject(error)
        }
      })

      let query = 'BEGIN;'

      entries.forEach((entry) => {
        const { pointId, data, timestamp } = entry
        // Convert the pointId into nodes
        const Nodes = Object.entries(pointIdToNodes(pointId))
        // Make the query by rebuilding the Nodes
        const tableName = Nodes[Nodes.length - 1][0]
        let statement = `insert into ${tableName}(`
        let values = null
        let fields = null

        // FIXME rewrite this part to handle a data in form of {value: string, quality: string}
        Nodes.slice(1).forEach(([nodeKey, nodeValue]) => {
          if (!fields) fields = `${escapeSpace(nodeKey)}`
          else fields = `${fields},${escapeSpace(nodeKey)}`

          if (!values) values = `'${nodeValue}'`
          else values = `${values},'${nodeValue}'`
        })
        // Converts data into fields for CLI
        // The data received from MQTT is type of string, so we need to transform it to Json
        try {
          const dataJson = JSON.parse(data)
          Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
            if (!fields) fields = `${escapeSpace(fieldKey)}`
            else fields = `${fields},${escapeSpace(fieldKey)}`

            if (!values) values = `'${fieldValue}'`
            else values = `${values},'${fieldValue}'`
          })
          fields += ',timestamp'
          values += `,'${timestamp}'`

          statement += `${fields}) values(${values});`

          query += statement
        } catch (error) {
          this.logger.error(error)
        }
      })

      query += 'COMMIT'

      this.client.query(query, (error) => {
        if (error) {
          this.logger.error(error)
          reject(ApiHandler.STATUS.COMMUNICATION_ERROR)
        } else {
          resolve(ApiHandler.STATUS.SUCCESS)
        }
      })
    })
  }
}

module.exports = TimescaleDB
