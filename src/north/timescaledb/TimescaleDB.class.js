const pg = require('pg')

const ApiHandler = require('../ApiHandler.class')
const LocalCache = require('../../engine/LocalCache.class')

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

    // Initiate local cache
    this.localCache = new LocalCache(engine, this)
  }

  /**
   * Makes a request for every entry received from the event.
   * @param {Object[]} values - The values
   * @return {void}
   */
  onUpdate(values) {
    this.makeRequest(values)
      .then(() => {
        this.logger.debug('Values saved')
      })
      .catch((error) => {
        this.logger.error(error)

        this.localCache.cacheValues(values)
      })
  }

  /**
   * Method to resend values stored in the local cache.
   * @param {Object[]} values - The values to resend
   * @return {Promise} - The resend status
   */
  resendValues(values) {
    return new Promise((resolve) => {
      this.makeRequest(values)
        .then(() => {
          resolve(true)
        })
        .catch((error) => {
          this.logger.error(error)
          resolve(false)
        })
    })
  }

  /**
   * Makes a TimescaleDB request with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  makeRequest(entries) {
    return new Promise((resolve, reject) => {
      const { host, user, password, db } = this.application.TimescaleDB
      // Build the url
      const url = `postgres://${user}:${password}@${host}/${db}`
      // Get client object and connect to the database
      this.client = new pg.Client(url)
      this.client.connect((error) => {
        if (error) {
          reject(error.stack)
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

        Nodes.slice(1).forEach(([nodeKey, nodeValue]) => {
          if (!fields) fields = `${escapeSpace(nodeKey)}`
          else fields = `${fields},${escapeSpace(nodeKey)}`

          if (!values) values = `'${nodeValue}'`
          else values = `${values},'${nodeValue}'`
        })
        // Converts data into fields for CLI
        // The data received from MQTT is type of string, so we need to transform it to Json
        const dataJson = JSON.parse(data)
        Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
          if (!fields) fields = `${escapeSpace(fieldKey)}`
          else fields = `${fields},${escapeSpace(fieldKey)}`

          if (!values) values = `'${fieldValue}'`
          else values = `${values},'${fieldValue}'`
        })
        fields += ',timestamp'
        values += `,'${new Date(timestamp).toISOString()}'`

        statement += `${fields}) values(${values});`

        query += statement
      })

      query += 'COMMIT'

      this.sendRequest(query, (error) => {
        if (error) {
          reject(error.stack)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Send the request.
   * @param {String} str - The query
   * @param {Function} callback - The callback
   * @return {void}
   */
  sendRequest(str, callback) {
    this.client.query(str, (error) => {
      if (error) {
        callback(error)
      } else {
        callback()
      }
    })
  }
}

module.exports = TimescaleDB
