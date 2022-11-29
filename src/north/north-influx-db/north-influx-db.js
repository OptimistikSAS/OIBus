import { vsprintf } from 'sprintf-js'
import objectPath from 'object-path'

import NorthConnector from '../north-connector.js'
import { httpSend } from '../../service/http-request-static-functions.js'

/**
 * Convert timestamp to the configured precision
 * @param {number} timestampTime - The original timestamp
 * @param {'ns'|'u'|'ms'|'s'|'m'|'h'} precision - The timestamp precision
 * @returns {number} - The converted timestamp
 */
const getConvertedTimestamp = (timestampTime, precision) => {
  switch (precision) {
    case 'ns':
      return 1000 * 1000 * timestampTime
    case 'u':
      return 1000 * timestampTime
    case 'ms':
      return timestampTime
    case 's':
      return Math.floor(timestampTime / 1000)
    case 'm':
      return Math.floor(timestampTime / 1000 / 60)
    case 'h':
      return Math.floor(timestampTime / 1000 / 60 / 60)
    default:
      return timestampTime
  }
}

/**
 * Class NorthInfluxDB - Send data to InfluxDB
 */
export default class NorthInfluxDB extends NorthConnector {
  static category = 'DatabaseIn'

  /**
   * Constructor for NorthInfluxDB
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {Object[]} proxies - The list of available proxies
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxies,
    logger,
  ) {
    super(
      configuration,
      proxies,
      logger,
    )
    this.canHandleValues = true

    const {
      host,
      user,
      password,
      db,
      precision,
      regExp,
      measurement,
      tags,
      useDataKeyValue,
      keyParentValue,
      timestampPathInDataValue,
    } = configuration.settings
    this.host = host
    this.user = user
    this.password = password
    this.database = db
    this.precision = precision
    this.regExp = regExp
    this.measurement = measurement
    this.tags = tags
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue
    this.timestampPathInDataValue = timestampPathInDataValue
  }

  /**
   * Handle values by sending them to InfluxDB.
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.trace(`Handle ${values.length} values.`)

    this.logger.info('Sending values to '
        + `${this.host}/write?u=${this.user}&p=<password>&db=${this.database}&precision=${this.precision}`)

    const url = `${this.host}/write?u=${this.user}&p=${await this.encryptionService.decryptText(this.password)}`
        + `&db=${this.database}&precision=${this.precision}`

    let body = ''

    values.forEach((entry) => {
      const {
        pointId,
        data,
      } = entry

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      const measurementValue = vsprintf(this.measurement, groups)
      const tagsValue = vsprintf(this.tags, groups)

      // If there are fewer groups than placeholders, vsprintf will put undefined.
      // We look for the number of 'undefined' before and after the replacement to see if this is the case
      if ((measurementValue.match(/undefined/g) || []).length > (this.measurement.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for the measurement.`)
        return
      }
      if ((tagsValue.match(/undefined/g) || []).length > (this.tags.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for tags.`)
        return
      }

      // Determinate the value to process depending on useDataKeyValue and keyParentValue parameters.
      // In fact, as some use cases can produce value structured as JSON objects, values which could be atomic values
      // (integer, float, ...) or JSON object must be processed
      let dataValue
      if (this.useDataKeyValue) {
        // The data to use is the key "value" of a JSON object data (data.value)
        // This data.value can be a JSON object or an atomic value (i.e. integer or float or string, ...)
        // If it's a JSON, the function return a data where the path is given by keyParentValue parameter even if the
        // JSON object contains more than one level of object.
        // For example: data = { value: { "level1": { "level2": { value: ..., timestamp:... } } } }
        // In this context :
        //   - the object to use, containing value and timestamp, is localised in data.value object by keyParentValue
        // level1.level2
        //   - To retrieve this object, we use objectPath with parameters: (data.value, 'level1.level2')
        dataValue = objectPath.get(data.value, this.keyParentValue)
      } else {
        // Data to use is the JSON object data
        dataValue = data
      }

      let timestamp
      if (this.timestampPathInDataValue) {
        // Case where the timestamp is within the dataValue fields received.
        timestamp = getConvertedTimestamp(
          new Date(objectPath.get(dataValue, this.timestampPathInDataValue)).getTime(),
          this.precision,
        )
        // Once retrieved, remove the timestamp from the fields to not take it again in the other fields
        objectPath.del(dataValue, this.timestampPathInDataValue)
      } else {
        // Case where the timestamp is directly at the root of the data received
        timestamp = getConvertedTimestamp(new Date(entry.timestamp).getTime(), this.precision)
      }

      // Converts data into fields for InfluxDB
      let fields = ''
      Object.entries(dataValue)
        .forEach(([fieldKey, fieldValue]) => {
          // Before inserting fieldKey in fields string, we must verify that fieldKey isn't store in tagsValue string
          // It's not useful to store a value in both tags and fields
          if (!tagsValue.includes(fieldKey)) {
            // Only insert string or number fields
            if (typeof fieldValue === 'string') {
              fields = fields !== '' ? `${fields},${fieldKey}="${fieldValue}"` : `${fieldKey}="${fieldValue}"`
            } else if (typeof fieldValue === 'number') {
              fields = fields !== '' ? `${fields},${fieldKey}=${fieldValue}` : `${fieldKey}=${fieldValue}`
            }
          }
        })

      // Replace spaces by _ and append entry to body
      body += `${measurementValue.replace(/ /g, '_')},`
              + `${tagsValue.replace(/ /g, '_')} `
              + `${fields.replace(/ /g, '_')} `
              + `${timestamp}\n`
    })

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    await httpSend(
      url,
      'POST',
      headers,
      body,
      this.cacheSettings.timeout,
      null,
    )
  }
}
