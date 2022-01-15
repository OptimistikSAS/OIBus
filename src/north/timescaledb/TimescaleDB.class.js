const { Client } = require('pg')
const { vsprintf } = require('sprintf-js')

const ApiHandler = require('../ApiHandler.class')

/**
 * Escape spaces.
 * @param {*} chars - The content to escape
 * @return {*} The escaped or the original content
 */
const escapeSpace = (chars) => chars.replace(/ /g, '\\ ')

/**
 * function return the content of value, that could be a Json object with path keys given by string value
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

class TimescaleDB extends ApiHandler {
  static category = 'DatabaseIn'

  /**
   * Constructor for TimescaleDB
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
      regExp,
      table,
      optFields,
      useDataKeyValue,
      keyParentValue,
    } = this.application.TimescaleDB
    this.host = host
    this.user = user
    this.password = password
    this.database = db
    this.regExp = regExp
    this.table = table
    this.optFields = optFields
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue

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
      this.statusData['Last handled values at'] = new Date().toISOString()
      this.statusData['Number of values sent since OIBus has started'] += values.length
      this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`
      this.updateStatusDataStream()
    } catch (error) {
      this.logger.error(error)
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    return values.length
  }

  /**
   * Connection to TimescaleDB
   * @return {void}
   */
  connect() {
    this.logger.info(`Connection to TimescaleDB: postgres://${this.user}:<password>@${this.host}/${this.database}`)

    // Build the url
    const url = `postgres://${this.user}:${this.encryptionService.decryptText(this.password)}@${this.host}/${this.database}`
    // Get client object and connect to the database
    this.timescaleClient = new Client(url)
    this.timescaleClient.connect((error) => {
      if (error) {
        this.logger.error(`Error during connection to TimescaleDB: ${error}`)
        this.clientPG = null
      } else {
        this.logger.info('Connection To TimescaleDB: OK')
      }
    })
  }

  /**
   * Disconnection from TimescaleDB
   * @return {void}
   */
  disconnect() {
    this.logger.info('Disconnection from TimeScaleDB')
    if (this.timescaleClient) {
      this.timescaleClient.end()
    }
  }

  /**
   * Makes a TimescaleDB request with the parameters in the Object arg.
   * @param {object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async makeRequest(entries) {
    let query = 'BEGIN;'
    let tableValue = ''
    let optFieldsValue = ''

    entries.forEach((entry) => {
      const { pointId, data, timestamp } = entry

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      tableValue = vsprintf(this.table, groups)

      // optFieldsValue is used to identify fields which are determined from pointId string
      optFieldsValue = vsprintf(this.optFields, groups)

      // If there are fewer groups than placeholders, vsprintf will put undefined.
      // We look for the number of 'undefined' before and after the replacement to see if this is the case
      if ((tableValue.match(/undefined/g) || []).length > (this.table.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for table ${this.table}`)
        return
      }

      if ((optFieldsValue.match(/undefined/g) || []).length > (this.optFields.match(/undefined/g) || []).length) {
        this.logger.error(`RegExp returned by ${this.regExp} for ${pointId} doesn't have enough groups for optionals fields ${this.optFields}`)
        return
      }

      // Make the query by rebuilding the Nodes
      const tableName = tableValue
      let statement = `insert into "${tableName}"(`
      let values = null
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

      // Converts data into fields for CLI
      try {
        Object.entries(dataValue).forEach(([fieldKey, fieldValue]) => {
          if (!fields) {
            fields = `"${escapeSpace(fieldKey)}"`
          } else {
            fields = `${fields},"${escapeSpace(fieldKey)}"`
          }

          if (!values) {
            values = `'${fieldValue}'`
          } else {
            values = `${values},'${fieldValue}'`
          }
        })
        fields += ',"created_at"'
        values += `,'${timestamp}'`

        // Some of optional fields are not presents in values, because they are calculated from pointId
        // Those fields must be added in values inserting in table
        optFieldsValue.split(',').forEach((optValueString) => {
          const optItems = optValueString.split(':')
          const optField = escapeSpace(optItems[0])
          if (!fields.includes(optField)) {
            if (!fields) fields = `"${optField}"`
            else fields = `${fields},"${optField}"`

            if (!values) values = `'${escapeSpace(optItems[1])}'`
            else values = `${values},'${escapeSpace(optItems[1])}'`
          }
        })

        statement += `${fields}) values(${values});`

        query += statement
      } catch (error) {
        this.logger.error(`Issue to build query: ${query} ${error.stack}`)
      }
    })

    query += 'COMMIT'
    await this.timescaleClient.query(query)
  }
}

module.exports = TimescaleDB
