const fs = require('fs/promises')
const path = require('path')
const csv = require('papaparse')
const fetch = require('node-fetch')
const https = require('https')

const { DateTime } = require('luxon')
const ProtocolHandler = require('../ProtocolHandler.class')

const oiaTimeValues = require('./formatters/oia-time-values')
const slims = require('./formatters/slims')

const parsers = {
  Raw: (httpResults) => ({ httpResults, latestDateRetrieved: new Date().toISOString() }),
  'OIAnalytics time values': oiaTimeValues,
  SLIMS: slims,
}

/**
 * Class RestApi
 */
class RestApi extends ProtocolHandler {
  static category = 'API'

  /**
   * Constructor for RestApi
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, {
      supportListen: false,
      supportLastPoint: false,
      supportFile: false,
      supportHistory: true,
    })

    const {
      requestMethod,
      host,
      port,
      endpoint,
      queryParams,
      body,
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
      acceptSelfSigned,
    } = this.dataSource.RestApi

    this.requestMethod = requestMethod
    this.host = host
    this.port = port
    this.endpoint = endpoint
    this.queryParams = queryParams
    this.body = body
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

    this.tmpFolder = path.resolve(this.engineConfig.caching.cacheFolder, this.dataSource.id)

    this.canHandleHistory = true
    this.handlesFiles = true
  }

  async init() {
    await super.init()
    try {
      await fs.stat(this.tmpFolder)
    } catch (error) {
      await fs.mkdir(this.tmpFolder, { recursive: true })
    }
  }

  async connect() {
    await super.connect()
    this.statusData['Connected at'] = new Date().toISOString()
    this.updateStatusDataStream()
    this.connected = true
  }

  /**
   * Get entries from the database since the last query completion, write them into a CSV file and send to the Engine.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {void}
   */
  async historyQuery(scanMode, startTime, endTime) {
    let updatedStartTime = startTime

    let results = null
    try {
      results = await this.getDataFromRestApi(startTime, endTime)
    } catch (error) {
      this.logger.error(JSON.stringify(error))
    }

    if (results) {
      // Use a formatter to format the retrieved data before converting it into csv or adding values
      let formattedResults = null
      if (!parsers[this.payloadParser]) {
        this.logger.error(`Parser "${this.payloadParser}" does not exist`)
        return
      }
      try {
        const { httpResults, latestDateRetrieved } = parsers[this.payloadParser](results)
        formattedResults = httpResults
        if (latestDateRetrieved > updatedStartTime.toISOString()) {
          updatedStartTime = latestDateRetrieved
        }
      } catch (parsingError) {
        this.logger.error(`Could not format the results with parser "${this.payloadParser}". Error: ${JSON.stringify(parsingError)}`)
        return
      }

      if (this.convertToCsv) {
        const fileName = this.fileName.replace('@CurrentDate', DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss'))
        const filePath = path.join(this.tmpFolder, fileName)
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
              this.logger.error(`Error compressing file ${fileName}. Sending it raw instead`)
              await this.addFile(filePath, false)
            }
          } else {
            await this.addFile(filePath, false)
          }
        } catch (error) {
          this.logger.error(error)
          return
        }
      } else {
        await this.addValues(formattedResults)
      }
    }

    const oldLastCompletedAt = this.lastCompletedAt[scanMode]
    this.lastCompletedAt[scanMode] = updatedStartTime
    if (this.lastCompletedAt[scanMode] !== oldLastCompletedAt) {
      this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt[scanMode].toISOString()}`)
      await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
    } else {
      this.logger.debug(`No update for lastCompletedAt. Last value: ${this.lastCompletedAt[scanMode].toISOString()}`)
    }
  }

  /**
   * Get new entries from a REST API.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {object} results - the retrieved results
   */
  async getDataFromRestApi(startTime, endTime) {
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
    const requestUrl = `${this.host}:${this.port}${this.endpoint}${this.formatQueryParams(startTime, endTime)}`

    if (this.body) {
      fetchOptions.body = JSON.stringify(this.body).replace(/@StartTime/g, new Date(startTime).toISOString())
        .replace(/@EndTime/g, new Date(endTime).toISOString())
    }
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

  /**
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {string} queryParamsString - the query params in string format
   */
  formatQueryParams(startTime, endTime) {
    if (this.queryParams?.length > 0) {
      let queryParamsString = '?'
      this.queryParams.forEach((queryParam, index) => {
        let value
        switch (queryParam.queryParamValue) {
          case '@StartTime':
            value = new Date(startTime).toISOString()
            break
          case '@EndTime':
            value = new Date(endTime).toISOString()
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
