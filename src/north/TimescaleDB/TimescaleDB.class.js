const { Client } = require('pg')
const { vsprintf } = require('sprintf-js')
const objectPath = require('object-path')

const { NorthHandler } = global

class TimescaleDB extends NorthHandler {
  /**
   * Constructor for TimescaleDB
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
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
  }

  /**
   * Handle values by sending them to TimescaleDB.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.trace(`TimescaleDB handleValues() call with ${values.length} values`)
    try {
      await this.makeRequest(values)
      this.statusData['Last handled values at'] = new Date().toISOString()
      this.statusData['Number of values sent since OIBus has started'] += values.length
      this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`
      this.updateStatusDataStream()
    } catch (error) {
      this.logger.error(error)
      throw NorthHandler.STATUS.COMMUNICATION_ERROR
    }
    return values.length
  }

  /**
   * Connection to TimescaleDB
   * @param {string} _additionalInfo - connection information to display in the logger
   * @return {void}
   */
  connect(_additionalInfo = '') {
    this.logger.info(`Connecting ${this.application.name} to TimescaleDB: postgres://${this.user}:<password>@${this.host}/${this.database}`)

    // Build the url
    const url = `postgres://${this.user}:${this.encryptionService.decryptText(this.password)}@${this.host}/${this.database}`
    // Get client object and connect to the database
    this.timescaleClient = new Client(url)
    this.timescaleClient.connect((error) => {
      if (error) {
        this.logger.error(`Error during connection to TimescaleDB: ${error}`)
        this.clientPG = null
      } else {
        super.connect(`url: ${url}`)
      }
    })
  }

  /**
   * Disconnection from TimescaleDB
   * @return {void}
   */
  async disconnect() {
    this.logger.info('Disconnection from TimeScaleDB')
    if (this.timescaleClient) {
      this.timescaleClient.end()
    }
    await super.disconnect()
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

      // Make the query by rebuilding the Nodes
      const tableName = tableValue
      let statement = `insert into "${tableName}"(`

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
        //   - To retrieve this object, we use objectPath with parameters: (data.value, 'level1.level2')
        dataValue = objectPath.get(data.value, this.keyParentValue)
      } else {
        // data to use is Json object data
        dataValue = data
      }

      // Converts data into fields for CLI
      try {
        let values = ''
        let fields = ''
        let timestamp
        if (this.timestampPathInDataValue) {
          // case where timestamp is within the dataValue fields received.
          timestamp = objectPath.get(dataValue, this.timestampPathInDataValue)
          // once taken into account, remove the timestamp from the fields to not take it again in the other fields
          objectPath.del(dataValue, this.timestampPathInDataValue)
        } else {
          // case where timestamp is directly at the root of the data received
          timestamp = entry.timestamp
        }

        // Filter the timestamp field in the dataValue object in case we already have a timestamp from the main json object
        Object.entries(dataValue).filter(([fieldKey]) => fieldKey !== 'timestamp').forEach(([fieldKey, fieldValue]) => {
          // Only insert string or number values
          if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
            fields = fields !== '' ? `${fields},"${fieldKey}"` : `"${fieldKey}"`
            values = values !== '' ? `${values},'${fieldValue}'` : `'${fieldValue}'`
          }
        })

        // Some of optional fields are not presents in values, because they are calculated from pointId
        // Those fields must be added in values inserting in table
        optFieldsValue.split(',').forEach((optValueString) => {
          const optItems = optValueString.split(':')
          if (!fields.includes(optItems[0])) {
            fields = fields !== '' ? `${fields},"${optItems[0]}"` : `"${optItems[0]}"`
            values = values !== '' ? `${values},'${optItems[1]}'` : `'${optItems[1]}'`
          }
        })

        fields += ',"timestamp"'
        values += `,'${timestamp}'`

        statement += `${fields.replace(/ /g, '\\ ')}) values(${values.replace(/ /g, '\\ ')});`

        query += statement
      } catch (error) {
        this.logger.error(`Issue to build query: ${query} ${error.stack}`)
      }
    })

    query += 'COMMIT'
    await this.timescaleClient.query(query)
  }
}

TimescaleDB.schema = require('./TimescaleDB.schema')

module.exports = TimescaleDB
