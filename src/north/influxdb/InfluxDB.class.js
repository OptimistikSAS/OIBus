const { vsprintf } = require('sprintf-js')

const ApiHandler = require('../ApiHandler.class')

/**
 * function return the content of value, that could be a Json object with path keys given by string value
 * without using eval function
 * @param {*} value - simple value (integer or float or string, ...) or Json object
 * @param {*} pathValue - The string path of value we want to retrieve in the Json Object
 * @return {*} The content of value depending on value type (object or simple value)
 */
const getJsonValueByStringPath = (value, pathValue) => {
  let tmpValue = value

  if (typeof value === 'object') {
    if (pathValue !== '') {
      const arrValue = pathValue.split('.')
      arrValue.forEach((k) => { tmpValue = tmpValue[k] })
    }
  }
  return tmpValue
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
      precision = 'ms',
      regExp,
      measurement,
      tags,
      useDataKeyValue,
      keyParentValue,
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
      const { pointId, data, timestamp } = entry

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      const measurementValue = vsprintf(this.measurement, groups)
      const tagsValue = vsprintf(this.tags, groups)

      // If there are less groups than placeholders, vsprintf will put undefined.
      // We look for the number of 'undefined' before and after the replace to see if this is the case
      if ((measurementValue.match(/undefined/g) || []).length > (this.measurement.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for measurement`)
        return
      }
      if ((tagsValue.match(/undefined/g) || []).length > (this.tags.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for tags`)
        return
      }

      // Converts data into fields for CLI
      let fields = null

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
        //   - To retrieve this object, we use getJsonValueByStringPath with parameters : (data.value, 'level1.level2')
        dataValue = getJsonValueByStringPath(data.value, this.keyParentValue)
      } else {
        // data to use is Json object data
        dataValue = data
      }

      Object.entries(dataValue).forEach(([fieldKey, fieldValue]) => {
        // Before inserting fieldKey in fields string, we must verify that fieldKey isn't store in tagsValue string
        // The reason is: in InfluxDB it's not useful to store value in tags ans in fields
        if (!tagsValue.includes(fieldKey)) {
          const escapedFieldKey = escapeSpace(fieldKey)
          let escapedFieldValue = escapeSpace(fieldValue)

          if (typeof escapedFieldValue === 'string') {
            escapedFieldValue = `"${escapedFieldValue}"`
          }
          if (!fields) fields = `${escapedFieldKey}=${escapedFieldValue}`
          else fields = `${fields},${escapedFieldKey}=${escapedFieldValue}`
        }
      })

      // Convert timestamp to the configured precision
      const timestampTime = (new Date(timestamp)).getTime()
      let preciseTimestamp
      switch (this.precision) {
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
    return this.engine.requestService.httpSend(url, 'POST', null, null, body, headers)
  }
}

module.exports = InfluxDB
