const fetch = require('node-fetch')

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

/**
 * Class InfluxDB - generates and sends InfluxDB requests
 */
class InfluxDB extends ApiHandler {
  /**
   * Constructor for InfluxDB
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
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  makeRequest(entries) {
    return new Promise((resolve, reject) => {
      const { host, user, password, db, precision = 'ms' } = this.application.InfluxDB
      const url = `http://${host}/write?u=${user}&p=${this.decryptPassword(password)}&db=${db}&precision=${precision}`

      let body = ''

      entries.forEach((entry) => {
        try {
          const { pointId, data, timestamp } = entry
          const Nodes = Object.entries(pointIdToNodes(pointId))
          const measurement = Nodes[Nodes.length - 1][0]

          // Convert nodes into tags for CLI
          let tags = null
          Nodes.slice(1).forEach(([tagKey, tagValue]) => {
            if (!tags) tags = `${escapeSpace(tagKey)}=${escapeSpace(tagValue)}`
            else tags = `${tags},${escapeSpace(tagKey)}=${escapeSpace(tagValue)}`
          })

          // Converts data into fields for CLI
          let fields = null
          // FIXME rewrite this part to handle a data in form of {value: string, quality: string}
          // The data received from MQTT is type of string, so we need to transform it to Json
          const dataJson = JSON.parse(decodeURI(data))
          Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
            if (!fields) fields = `${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
            else fields = `${fields},${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
          })

          // Convert timestamp to the configured precision
          let preciseTimestamp = new Date(timestamp).getTime()
          switch (precision) {
            case 'ns':
              preciseTimestamp = 1000 * 1000 * timestamp
              break
            case 'u':
              preciseTimestamp = 1000 * timestamp
              break
            case 'ms':
              break
            case 's':
              preciseTimestamp = Math.floor(timestamp / 1000)
              break
            case 'm':
              preciseTimestamp = Math.floor(timestamp / 1000 / 60)
              break
            case 'h':
              preciseTimestamp = Math.floor(timestamp / 1000 / 60 / 60)
              break
            default:
              preciseTimestamp = timestamp
          }

          // Append entry to body
          body += `${measurement},${tags} ${fields} ${preciseTimestamp}\n`
        } catch (error) {
          this.logger.error(error)
        }
      })

      // Send data to InfluxDB
      fetch(url, {
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      })
        .then((response) => {
          if (response.ok) {
            resolve()
          } else {
            reject(response.statusText)
          }
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}

InfluxDB.schema = require('./schema')

module.exports = InfluxDB
