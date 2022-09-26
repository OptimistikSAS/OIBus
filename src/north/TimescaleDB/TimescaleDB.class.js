const { Client } = require('pg')
const { vsprintf } = require('sprintf-js')
const objectPath = require('object-path')

const NorthConnector = require('../NorthConnector.class')

class TimescaleDB extends NorthConnector {
  static category = 'DatabaseIn'

  /**
   * Constructor for TimescaleDB
   * @constructor
   * @param {Object} settings - The North connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine)
    this.canHandleValues = true

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
    } = this.settings.TimescaleDB
    this.host = host
    this.user = user
    this.password = password
    this.database = db
    this.regExp = regExp
    this.table = table
    this.optFields = optFields
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue

    // Initialized at connection
    this.client = null
  }

  /**
   * Connection to TimescaleDB
   * @param {String} _additionalInfo - Connection information to display in the logger
   * @returns {Promise<void>} - The result promise
   */
  async connect(_additionalInfo = '') {
    this.logger.info(`Connecting North "${this.settings.name}" to TimescaleDB: `
        + `postgres://${this.user}:<password>@${this.host}/${this.database}`)

    const url = `postgres://${this.user}:${await this.encryptionService.decryptText(this.password)}@${this.host}/${this.database}`

    this.client = new Client(url)

    await this.client.connect()
    await super.connect(`url: ${url}`)
  }

  /**
   * Handle values by sending them to TimescaleDB.
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.trace(`Handle ${values.length} values.`)

    let query = 'BEGIN;'
    let tableValue = ''
    let optFieldsValue = ''

    values.forEach((entry) => {
      const { pointId, data } = entry

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

      // Make the query
      const tableName = tableValue
      let statement = `insert into "${tableName}"(`

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
        timestamp = objectPath.get(dataValue, this.timestampPathInDataValue)
        // Once retrieved, remove the timestamp from the fields to not take it again in the other fields
        objectPath.del(dataValue, this.timestampPathInDataValue)
      } else {
        // Case where the timestamp is directly at the root of the data received
        timestamp = entry.timestamp
      }

      let valuesToInsert = ''
      let fields = ''
      // Filter the timestamp field in the dataValue object in case we already have a timestamp from the main JSON object
      Object.entries(dataValue).filter(([fieldKey]) => fieldKey !== 'timestamp')
        .forEach(([fieldKey, fieldValue]) => {
          // Only insert string or number
          if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
            fields = fields !== '' ? `${fields},"${fieldKey}"` : `"${fieldKey}"`
            valuesToInsert = valuesToInsert !== '' ? `${valuesToInsert},'${fieldValue}'` : `'${fieldValue}'`
          }
        })

      // Some of optional fields are not present in valuesToInsert, because they are calculated from pointId
      // Those fields must be added in valuesToInsert
      optFieldsValue.split(',').forEach((optValueString) => {
        const optItems = optValueString.split(':')
        if (!fields.includes(optItems[0])) {
          fields = fields !== '' ? `${fields},"${optItems[0]}"` : `"${optItems[0]}"`
          valuesToInsert = valuesToInsert !== '' ? `${valuesToInsert},'${optItems[1]}'` : `'${optItems[1]}'`
        }
      })

      fields += ',"timestamp"'
      valuesToInsert += `,'${timestamp}'`

      // Replace spaces by _ and append entry to body
      statement += `${fields.replace(/ /g, '_')}) `
          + `values(${valuesToInsert.replace(/ /g, '_')});`

      query += statement
    })

    query += 'COMMIT'
    await this.client.query(query)
  }

  /**
   * Disconnection from TimescaleDB
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    this.logger.info(`Disconnecting North "${this.settings.name}" from TimescaleDB`)
    if (this.client) {
      this.client.end()
    }
    await super.disconnect()
  }
}

module.exports = TimescaleDB
