const { Client } = require('pg')

const ApiHandler = require('../ApiHandler.class')
const Logger = require('../../engine/Logger.class')

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

    const { logParameters } = applicationParameters.TimescaleDB

    this.logger = new Logger()
    this.logger.changeParameters(this.engineConfig.logParameters, logParameters, this.constructor.name)

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to TimescaleDB.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`TimescaleDB handleValues() call with ${values.length} values`)
    try {
      await this.makeRequest(values)
    } catch (error) {
      this.logger.error(error)
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    return values.length
  }

  /**
   * Makes a TimescaleDB request with the parameters in the Object arg.
   * @param {object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async makeRequest(entries) {
    const { host, user, password, db } = this.application.TimescaleDB
    // Build the url
    const url = `postgres://${user}:${this.encryptionService.decryptText(password)}@${host}/${db}`
    // Get client object and connect to the database
    const client = new Client(url)
    await client.connect()

    let query = 'BEGIN;'

    entries.forEach((entry) => {
      const { pointId, data, timestamp } = entry
      // Convert the pointId into nodes
      const Nodes = Object.entries(pointIdToNodes(pointId))
      // Make the query by rebuilding the Nodes
      const tableName = 'oibus_test' // Nodes[Nodes.length - 1][0]
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
      try {
        Object.entries(data).forEach(([fieldKey, fieldValue]) => {
          if (!fields) fields = `${escapeSpace(fieldKey)}`
          else fields = `${fields},${escapeSpace(fieldKey)}`

          if (!values) values = `'${fieldValue}'`
          else values = `${values},'${fieldValue}'`
        })
        fields += ',created_at'
        values += `,'${timestamp}'`

        statement += `${fields}) values(${values});`

        query += statement
      } catch (error) {
        this.logger.error(`Issue to build query: ${query} ${error.stack}`)
      }
    })

    query += 'COMMIT'

    await client.query(query)
    await client.end()
  }
}

module.exports = TimescaleDB
