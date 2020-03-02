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
    const url = `http://${host}/write?u=${user}&p=${this.decryptPassword(password)}&db=${db}&precision=${precision}`

    let body = ''

    entries.forEach((entry) => {
      const { pointId, data, timestamp } = entry

      // The returned array has the matched text as the first item,
      // and then one item for each parenthetical capture group of the matched text.
      const mainRegExp = new RegExp(regExp)
      const groups = mainRegExp.exec(pointId)

      let measurementValue = measurement
      let tagsValue = tags
      let match
      const replaceRegExp = new RegExp('(%[0-9]+)')

      // Find all '%X' template we have to replace for measurement
      const measurementGroupIndexesToReplace = []
      do {
        match = replaceRegExp.exec(measurement)
        if (match) {
          measurementGroupIndexesToReplace.push(match[0].replace('%', ''));
        }
      } while (match)

      // Find all '%X' template we have to replace for tags
      const tagsGroupIndexesToReplace = []
      do {
        match = replaceRegExp.exec(tags)
        if (match) {
          tagsGroupIndexesToReplace.push(match[0].replace('%', ''));
        }
      } while (match)

      // Replace '%X' for measurement if the given group index exists
      let hasMissingGroup = false
      measurementGroupIndexesToReplace.forEach((index) => {
        if (groups.length >= index) {
          measurementValue = measurementValue.replace(`%${index}`, groups[index])
        } else {
          hasMissingGroup = true
          this.logger.error(`RegExp return by ${regExp} for ${pointId} doesn't have group %${index}`)
        }
      })

      // Replace '%X' for tags if the given group index exists
      tagsGroupIndexesToReplace.forEach((index) => {
        if (groups.length >= index) {
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
