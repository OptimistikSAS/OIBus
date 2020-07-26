const { vsprintf } = require('sprintf-js')
const ApiHandler = require('../ApiHandler.class')

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
  async handleValues(values) {
    this.logger.silly(`Link handleValues() call with ${values.length} values`)
    try {
      await this.makeRequest(values)
    } catch (error) {
      this.logger.error(error)
      throw error
    }
    return values.length
  }

  /**
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async makeRequest(entries) {
    const { host, user, password, db, precision = 'ms', regExp, measurement, tags } = this.application.InfluxDB
    const url = `${host}/write?u=${user}&p=${this.decryptPassword(password)}&db=${db}&precision=${precision}`

    let body = ''

    entries.forEach((entry) => {
      const { pointId, data, timestamp } = entry

      const mainRegExp = new RegExp(regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      const measurementValue = vsprintf(measurement, groups)
      const tagsValue = vsprintf(tags, groups)

      // If there are less groups than placeholders, vsprintf will put undefined.
      // We look for the number of 'undefined' before and after the replace to see if this is the case
      if ((measurementValue.match(/undefined/g) || []).length > (measurement.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${regExp} for ${pointId} doesn't have enough groups for measurement`)
        return
      }
      if ((tagsValue.match(/undefined/g) || []).length > (tags.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${regExp} for ${pointId} doesn't have enough groups for tags`)
        return
      }

      // Converts data into fields for CLI
      let fields = null
      Object.entries(data).forEach(([fieldKey, fieldValue]) => {
        const escapedFieldKey = escapeSpace(fieldKey)
        let escapedFieldValue = escapeSpace(fieldValue)

        if (typeof escapedFieldValue === 'string') {
          escapedFieldValue = `"${escapedFieldValue}"`
        }

        if (!fields) fields = `${escapedFieldKey}=${escapedFieldValue}`
        else fields = `${fields},${escapedFieldKey}=${escapedFieldValue}`
      })

      // Convert timestamp to the configured precision
      const timestampTime = (new Date(timestamp)).getTime()
      let preciseTimestamp
      switch (precision) {
        case 'ns':
          preciseTimestamp = 1000 * 1000 * timestampTime
          break
        case 'u':
          preciseTimestamp = 1000 * timestampTime
          break
        case 'ms':
          preciseTimestamp = timestampTime
          break
        case 's':
          preciseTimestamp = Math.floor(timestampTime / 1000)
          break
        case 'm':
          preciseTimestamp = Math.floor(timestampTime / 1000 / 60)
          break
        case 'h':
          preciseTimestamp = Math.floor(timestampTime / 1000 / 60 / 60)
          break
        default:
          preciseTimestamp = timestampTime
      }
      // Append entry to body
      body += `${measurementValue},${tagsValue} ${fields} ${preciseTimestamp}\n`
    })

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    return this.engine.sendRequest(url, 'POST', null, null, body, headers)
  }
}

module.exports = InfluxDB
