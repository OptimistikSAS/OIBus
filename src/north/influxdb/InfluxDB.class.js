const fetch = require('node-fetch')

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
    return true
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

      let measurementValue = measurement
      let tagsValue = tags
      let match

      // Find all '%X' template we have to replace for measurement
      const measurementGroupIndexesToReplace = []
      const replaceMeasurementRegExp = new RegExp('(%[0-9]+)', 'g')
      // eslint-disable-next-line no-cond-assign
      while ((match = replaceMeasurementRegExp.exec(measurement)) !== null) {
        measurementGroupIndexesToReplace.push(match[0].replace('%', ''))
      }

      // Find all '%X' template we have to replace for tags
      const tagsGroupIndexesToReplace = []
      const replaceTagsRegExp = new RegExp('(%[0-9]+)', 'g')
      // eslint-disable-next-line no-cond-assign
      while ((match = replaceTagsRegExp.exec(tags)) !== null) {
        tagsGroupIndexesToReplace.push(match[0].replace('%', ''))
      }

      // Replace '%X' for measurement if the given group index exists
      let hasMissingGroup = false
      measurementGroupIndexesToReplace.forEach((index) => {
        if (groups.length > index) {
          measurementValue = measurementValue.replace(`%${index}`, groups[index])
        } else {
          hasMissingGroup = true
          this.logger.error(`RegExp return by ${regExp} for ${pointId} doesn't have group %${index}`)
        }
      })

      // Replace '%X' for tags if the given group index exists
      tagsGroupIndexesToReplace.forEach((index) => {
        if (groups.length > index) {
          tagsValue = tagsValue.replace(`%${index}`, groups[index])
        } else {
          hasMissingGroup = true
          this.logger.error(`RegExp return by ${regExp} for ${pointId} doesn't have group %${index}`)
        }
      })

      // If there is any missing group index return
      if (hasMissingGroup) {
        return
      }

      // Converts data into fields for CLI
      let fields = null
      Object.entries(data).forEach(([fieldKey, fieldValue]) => {
        if (!fields) fields = `${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
        else fields = `${fields},${escapeSpace(fieldKey)}=${escapeSpace(fieldValue)}`
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

    const response = await fetch(url, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    return true
  }
}

module.exports = InfluxDB
