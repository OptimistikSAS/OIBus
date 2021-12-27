const fs = require('fs/promises')
const path = require('path')
const csv = require('papaparse')
const moment = require('moment-timezone')
const fetch = require('node-fetch')
const https = require('https')

const ProtocolHandler = require('../ProtocolHandler.class')

const oiaTimeValues = require('./formatters/oia-time-values')

const parsers = {
  Raw: (results) => results,
  'OIAnalytics time values': oiaTimeValues,
}

/**
 * Class RestApi
 */
class RestApi extends ProtocolHandler {
  static category = 'IoT'

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
      requestMethod,
      host,
      port,
      endpoint,
      queryParams,
      authentication,
      connectionTimeout,
      requestTimeout,
      fileName,
      compression,
      delimiter,
      dateFormat,
      timeColumn,
      payloadParser,
      convertToCsv,
      acceptSelfSigned = false,
    } = this.dataSource.RestApi

    this.requestMethod = requestMethod
    this.host = host
    this.port = port
    this.endpoint = endpoint
    this.queryParams = queryParams
    this.authentication = authentication
    this.connectionTimeout = connectionTimeout
    this.requestTimeout = requestTimeout
    this.fileName = fileName
    this.compression = compression
    this.delimiter = delimiter
    this.dateFormat = dateFormat
    this.timeColumn = timeColumn
    this.acceptSelfSigned = acceptSelfSigned
    this.payloadParser = payloadParser
    this.convertToCsv = convertToCsv

    const { engineConfig: { caching: { cacheFolder } } } = this.engine.configService.getConfig()
    this.tmpFolder = path.resolve(cacheFolder, this.dataSource.id)

    this.canHandleHistory = true
    this.handlesFiles = true
  }

  async connect() {
    await super.connect()
    // Create tmp folder if not exists
    try {
      await fs.stat(this.tmpFolder)
    } catch (error) {
      await fs.mkdir(this.tmpFolder, { recursive: true })
    }

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
    let results = null
    try {
      this.currentDate = new Date().toISOString()
      results = await this.getDataFromRestApi()
    } catch (error) {
      this.logger.error(JSON.stringify(error))
    }

    if (results) {
      // Use a formatter to format the retrieved data before converting it into csv or adding values
      let formattedResults = null
      try {
        formattedResults = parsers[this.payloadParser](results)
      } catch {
        this.logger.error(`Could not format the results with parser ${this.payloadParser}`)
      }

      if (this.convertToCsv) {
        const filename = this.fileName.replace('@CurrentDate', moment()
          .format('YYYY_MM_DD_HH_mm_ss'))
        const filePath = path.join(this.tmpFolder, filename)
        this.logger.debug(`Converting HTTP payload to CSV file ${filePath}`)
        const csvContent = await this.generateCSV(formattedResults)
        try {
          await fs.writeFile(filePath, csvContent)
          if (this.compression) {
            try {
              // Compress and send the compressed file
              const gzipPath = `${filePath}.gz`
              await this.compress(filePath, gzipPath)
              await this.addFile(gzipPath, false)
              await fs.unlink(filePath)
            } catch (compressionError) {
              this.logger.error(`Error compressing file ${filename}. Sending it raw instead`)
              await this.addFile(filePath, false)
            }
          } else {
            await this.addFile(filePath, false)
          }
        } catch (error) {
          this.logger.error(error)
        }
      } else {
        await this.addValues(formattedResults)
      }

      this.lastCompletedAt = this.currentDate
      await this.setConfig('lastCompletedAt', this.lastCompletedAt)
    }
  }

  /**
   * Get new entries from a REST API.
   * @return {object} results - the retrieved results
   */
  async getDataFromRestApi() {
    const headers = {}
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
    const fetchOptions = {
      method: this.requestMethod,
      headers,
      agent: this.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
      timeout: this.connectionTimeout,
    }
    const requestUrl = `${this.host}:${this.port}${this.endpoint}${this.formatQueryParams()}`

    // eslint-disable-next-line max-len
    this.logger.info(`Requesting data ${this.authentication?.type ? `with ${this.authentication.type}` : 'without'} authentication and ${this.requestMethod} method: ${requestUrl}`)
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

    return results
  }

  formatQueryParams() {
    if (this.queryParams?.length > 0) {
      let queryParamsString = '?'
      this.queryParams.forEach((queryParam, index) => {
        let value
        switch (queryParam.queryParamValue) {
          case '@LastCompletedDate':
            value = new Date(this.lastCompletedAt).toISOString()
            break
          case '@CurrentDate':
            value = this.currentDate
            break
          default:
            value = queryParam.queryParamValue
        }
        queryParamsString += `${encodeURIComponent(queryParam.queryParamKey)}=${encodeURIComponent(value)}`
        if (index < this.queryParams.length - 1) {
          queryParamsString += '&'
        }
      })
      return queryParamsString
    }
    return ''
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    const options = {
      header: true,
      delimiter: this.delimiter,
    }
    return csv.unparse(result, options)
  }
}

module.exports = RestApi
