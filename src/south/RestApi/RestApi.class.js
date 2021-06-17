const fs = require('fs')
const path = require('path')
const csv = require('papaparse')
const moment = require('moment-timezone')
const fetch = require('node-fetch')
const https = require('https')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class RestApi
 */
class RestApi extends ProtocolHandler {
  /**
   * Constructor for RestApi
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const {
      apiType,
      host,
      port,
      entity,
      authentication,
      connectionTimeout,
      requestTimeout,
      startDate,
    } = this.dataSource.RestApi

    this.apiType = apiType
    this.host = host
    this.port = port
    this.entity = entity
    this.authentication = authentication
    this.connectionTimeout = connectionTimeout
    this.requestTimeout = requestTimeout
    this.startDate = startDate // "startDate" is currently a "hidden" parameter of oibus.json

    const { engineConfig: { caching: { cacheFolder } } } = this.engine.configService.getConfig()
    this.tmpFolder = path.resolve(cacheFolder, this.dataSource.dataSourceId)

    // Create tmp folder if not exists
    if (!fs.existsSync(this.tmpFolder)) {
      fs.mkdirSync(this.tmpFolder, { recursive: true })
    }

    this.handlesPoints = true
  }

  async connect() {
    await super.connect()
    this.lastCompletedAt = await this.getConfig('lastCompletedAt')
    if (!this.lastCompletedAt) {
      this.lastCompletedAt = this.startDate ? new Date(this.startDate).toISOString() : new Date().toISOString()
    }
  }

  /**
   * Get entries from the database since the last query completion, write them into a CSV file and send to the Engine.
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  async onScanImplementation(_scanMode) {
    let result = []
    try {
      switch (this.apiType) {
        case 'octopus':
          result = await this.getDataFromOctopus()
          break
        default:
          this.logger.error(`Api type ${this.apiType} not supported by ${this.dataSource.dataSourceId}`)
          result = []
      }
    } catch (error) {
      this.logger.error(JSON.stringify(error))
    }

    this.logger.debug(`Found ${result.length} results`)

    if (result.length > 0) {
      this.lastCompletedAt = this.setLastCompletedAt(result)
      await this.setConfig('lastCompletedAt', this.lastCompletedAt)
      // send the packet immediately to the engine
      this.addValues(result)
    }
  }

  /**
   * Get new entries from Octopus.
   * @returns {void}
   */
  async getDataFromOctopus() {
    const data = { property: this.dataSource.points[0].pointId }
    this.logger.silly(`Requesting point ${JSON.stringify(data)}`)

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    switch (this.authentication.type) {
      case 'Basic': {
        const decryptedPassword = this.engine.encryptionService.decryptText(this.authentication.password)
        const basic = Buffer.from(`${this.authentication.username}:${decryptedPassword}`).toString('base64')
        headers.Authorization = `Basic ${basic}`
        break
      }
      case 'API Key': {
        headers[this.authentication.key] = this.engine.encryptionService.decryptText(this.authentication.secretKey)
        break
      }
      case 'Bearer': {
        headers.Authorization = `Bearer ${this.engine.encryptionService.decryptText(this.authentication.token)}`
        break
      }
      default:
        break
    }

    const agent = new https.Agent({ rejectUnauthorized: false })

    const fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      agent,
      timeout: this.connectionTimeout,
    }

    const requestUrl = `${this.host}:${this.port}/Thingworx/Things/${this.entity}/Services/ODAgetPropertyValues`

    let results = null
    try {
      const response = await fetch(requestUrl, fetchOptions)
      if (!response.ok) {
        const responseError = {
          responseError: true,
          statusCode: response.status,
          error: new Error(response.statusText),
        }
        return Promise.reject(responseError)
      }
      results = await response.json()
    } catch (error) {
      const connectError = {
        responseError: false,
        error,
      }
      return Promise.reject(connectError)
    }

    return results.array.map((point) => {
      const resultPoint = {}
      Object.entries(point).forEach(([key, value]) => {
        if (key === 'timestamp') {
          resultPoint.timestamp = value
        } else {
          resultPoint.pointId = key
          resultPoint.data = { value }
        }
      })
      return resultPoint
    })
  }

  /**
   * Function used to parse an entry and update the lastCompletedAt if needed
   * @param {*} entryList - on sql result item
   * @return {string} date - the updated date in iso string format
   */
  setLastCompletedAt(entryList) {
    let newLastCompletedAt = this.lastCompletedAt
    entryList.forEach((entry) => {
      if (entry[this.timeColumn] instanceof Date && entry[this.timeColumn] > new Date(newLastCompletedAt)) {
        newLastCompletedAt = entry[this.timeColumn].toISOString()
      } else if (entry[this.timeColumn]) {
        const entryDate = new Date(entry[this.timeColumn])
        if (entryDate.toString() !== 'Invalid Date') {
          // When of type string, We need to take back the js added timezone since it is not in the original string coming from the database
          // When of type number, no need to take back the timezone offset because it represents the number of seconds from 01/01/1970
          // eslint-disable-next-line max-len
          const entryDateWithoutTimezoneOffset = typeof entry[this.timeColumn] === 'string' ? new Date(entryDate.getTime() - entryDate.getTimezoneOffset() * 60000) : entryDate
          if (entryDateWithoutTimezoneOffset > new Date(newLastCompletedAt)) {
            newLastCompletedAt = entryDateWithoutTimezoneOffset.toISOString()
          }
        }
      }
    })
  }

  /**
   * Format date taking into account the timezone configuration.
   * Since we don't know how the date is actually stored in the database, we read it as UTC time
   * and format it as it would be in the configured timezone.
   * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
   * @param {Date} date - The date to format
   * @param {String} timezone - The timezone to use to replace the timezone of the date
   * @param {String} dateFormat - The format of the date to use for the return result
   * @returns {string} - The formatted date with timezone
   */
  static formatDateWithTimezone(date, timezone, dateFormat) {
    const timestampWithoutTZAsString = moment.utc(date).format('YYYY-MM-DD HH:mm:ss.SSS')
    return moment.tz(timestampWithoutTZAsString, timezone).format(dateFormat)
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    // loop through each value and format date to timezone if value is Date
    result.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const value = row[key]
        if (value instanceof Date) {
          row[key] = RestApi.formatDateWithTimezone(value, this.timezone, this.dateFormat)
        }
      })
    })
    const options = {
      header: true,
      delimiter: this.delimiter,
    }
    return csv.unparse(result, options)
  }
}

module.exports = RestApi
