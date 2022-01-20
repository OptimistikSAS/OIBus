const { vsprintf } = require('sprintf-js')
const objectPath = require('object-path')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class InfluxDB - generates and sends InfluxDB requests
 */
class InfluxDB extends ApiHandler {
  static category = 'DatabaseIn'

  /**
   * Constructor for InfluxDB
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
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
    } = this.application.InfluxDB
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

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to InfluxDB.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`InfluxDB handleValues() call with ${values.length} values`)
    try {
      await this.makeRequest(values)
      this.statusData['Last handled values at'] = new Date().toISOString()
      this.statusData['Number of values sent since OIBus has started'] += values.length
      this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`
      this.updateStatusDataStream()
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
    this.logger.info(`Sending values to ${this.host}/write?u=${this.user}&p=<password>&db=${this.database}&precision=${this.precision}`)
    // eslint-disable-next-line max-len
    const url = `${this.host}/write?u=${this.user}&p=${this.encryptionService.decryptText(this.password)}&db=${this.database}&precision=${this.precision}`

    let body = ''

    entries.forEach((entry) => {
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
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for measurement`)
        return
      }
      if ((tagsValue.match(/undefined/g) || []).length > (this.tags.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for tags`)
        return
      }

      // Determinate the value to process depending on useDataKeyValue and keyParentValue parameters
      // In fact, as some use cases can produce value structured as Json Object, code is modified to process value which could be
      // simple value (integer, float, ...) or Json object
      let dataValue
      if (this.useDataKeyValue) {
        // data to use is value key of Json object data (data.value)
        // this data.value could be a Json object or simple value (i.e. integer or float or string, ...)
        // If it's a json, the function return data where path is given by keyParentValue parameter
        // even if json object containing more than one level of object.
        // for example : data : {value: {"level1":{"level2":{value:..., timestamp:...}}}}
        // in this context :
        //   - the object to use, containing value and timestamp, is localised in data.value object by keyParentValue string : level1.level2
        //   - To retrieve this object, we use getJsonValueByStringPath with parameters: (data.value, 'level1.level2')
        dataValue = objectPath.get(data.value, this.keyParentValue)
      } else {
        // data to use is Json object data
        dataValue = data
      }

      let timestamp
      if (this.timestampPathInDataValue) {
        // case where timestamp is within the dataValue fields received.
        timestamp = this.getConvertedTimestamp(new Date(objectPath.get(dataValue, this.timestampPathInDataValue)).getTime())
        // once taken into account, remove the timestamp from the fields to not take it again in the other fields
        objectPath.del(dataValue, this.timestampPathInDataValue)
      } else {
        // case where timestamp is directly at the root of the data received
        timestamp = this.getConvertedTimestamp(new Date(entry.timestamp).getTime())
      }

      // Converts data into fields for CLI
      let fields = ''
      Object.entries(dataValue)
        .forEach(([fieldKey, fieldValue]) => {
          // Before inserting fieldKey in fields string, we must verify that fieldKey isn't store in tagsValue string
          // The reason is: in InfluxDB it's not useful to store value in tags and in fields
          if (!tagsValue.includes(fieldKey)) {
            // Only insert string or number fields
            if (typeof fieldValue === 'string') {
              fields = fields !== '' ? `${fields},${fieldKey}="${fieldValue}"` : `${fieldKey}="${fieldValue}"`
            } else if (typeof fieldValue === 'number') {
              fields = fields !== '' ? `${fields},${fieldKey}=${fieldValue}` : `${fieldKey}=${fieldValue}`
            }
          }
        })

      // Append entry to body
      body += `${measurementValue.replace(/ /g, '\\ ')},${tagsValue.replace(/ /g, '\\ ')} ${fields.replace(/ /g, '\\ ')} ${timestamp}\n`
    })

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    return this.engine.requestService.httpSend(url, 'POST', null, null, body, headers)
  }

  /**
   * Convert timestamp to the configured precision
   * @param {number} timestampTime - the original timestamp
   * @returns {number} - The converted timestamp
   */
  getConvertedTimestamp(timestampTime) {
    switch (this.precision) {
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
}

module.exports = InfluxDB
