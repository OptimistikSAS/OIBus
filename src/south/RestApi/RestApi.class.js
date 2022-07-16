const fs = require('fs/promises')
const path = require('path')
const csv = require('papaparse')
const fetch = require('node-fetch')
const https = require('https')
const http = require('http')

const {SouthHandler} = global

const oiaTimeValues = require('./formatters/oia-time-values')
const slims = require('./formatters/slims')

const parsers = {
  Raw: (httpResults) => ({ httpResults, latestDateRetrieved: new Date().toISOString() }),
  'OIAnalytics time values': oiaTimeValues,
  SLIMS: slims,
}

const requestWithBody = (body, options = {}) => new Promise((resolve, reject) => {
  const callback = (response) => {
    let str = ''
    response.on('data', (chunk) => {
      str += chunk
    })
    response.on('end', () => {
      try {
        const parsedResult = JSON.parse(str)
        resolve(parsedResult)
      } catch (error) {
        reject(error)
      }
    })
  }

  const req = (options.protocol === 'https:' ? https : http).request(options, callback)
  req.on('error', (e) => {
    reject(e)
  })
  req.write(body)
  req.end()
})

/**
 * Class RestApi
 */
class RestApi extends SouthHandler {
  static category = 'API'

  /**
   * Constructor for RestApi
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {BaseEngine} engine - The engine
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
      protocol,
      endpoint,
      queryParams,
      body,
      authentication,
      connectionTimeout,
      requestTimeout,
      fileName,
      compression,
      delimiter,
      payloadParser,
      convertToCsv,
      acceptSelfSigned,
      variableDateFormat,
      maxReadInterval,
      readIntervalDelay,
    } = this.dataSource.RestApi

    this.requestMethod = requestMethod
    this.host = host
    this.port = port
    this.protocol = protocol
    this.endpoint = endpoint
    this.queryParams = queryParams
    this.body = body
    this.authentication = authentication
    this.connectionTimeout = connectionTimeout
    this.requestTimeout = requestTimeout
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.fileName = fileName
    this.compression = compression
    this.delimiter = delimiter
    this.acceptSelfSigned = acceptSelfSigned
    this.payloadParser = payloadParser
    this.convertToCsv = convertToCsv
    this.variableDateFormat = variableDateFormat

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
   * @return {Promise<number>} - The on scan promise: -1 if an error occurred, 0 otherwise
   */
  async historyQuery(scanMode, startTime, endTime) {
    let updatedStartTime = startTime

    let results = null
    this.logger.debug(`Read from ${startTime.toISOString()} to ${endTime.toISOString()} (${endTime - startTime}ms)`)

    try {
      results = await this.getDataFromRestApi(startTime, endTime)
    } catch (error) {
      this.logger.error(JSON.stringify(error))
      return -1
    }

    if (results) {
      // Use a formatter to format the retrieved data before converting it into csv or adding values
      let formattedResults = null
      if (!parsers[this.payloadParser]) {
        this.logger.error(`Parser "${this.payloadParser}" does not exist`)
        return -1
      }
      try {
        const { httpResults, latestDateRetrieved } = parsers[this.payloadParser](results)
        formattedResults = httpResults
        if (latestDateRetrieved > updatedStartTime) {
          updatedStartTime = latestDateRetrieved
        }
      } catch (parsingError) {
        this.logger.error(`Could not format the results with parser "${this.payloadParser}". Error: ${parsingError.message}`)
        return -1
      }

      if (formattedResults.length > 0) {
        this.logger.info(`Found ${formattedResults.length} results between ${startTime.toISOString()} and ${endTime.toISOString()}`)
        if (this.convertToCsv) {
          const fileName = this.replaceFilenameWithVariable(this.fileName, this.queryParts[scanMode])
          const filePath = path.join(this.tmpFolder, fileName)
          this.logger.debug(`Converting HTTP payload to CSV file ${filePath}`)
          const csvContent = await this.generateCSV(formattedResults)
          try {
            this.logger.debug(`Writing CSV file at ${filePath}`)
            await fs.writeFile(filePath, csvContent)

            if (this.compression) {
              try {
                // Compress and send the compressed file
                const gzipPath = `${filePath}.gz`
                await this.compress(filePath, gzipPath)
                try {
                  await fs.unlink(filePath)
                  this.logger.info(`File ${filePath} compressed and deleted`)
                } catch (unlinkError) {
                  this.logger.error(unlinkError)
                }

                this.logger.debug(`Sending compressed ${gzipPath} to Engine.`)
                await this.addFile(gzipPath, false)
              } catch (compressionError) {
                this.logger.error(`Error compressing file ${filePath}. Sending it raw instead`)
                await this.addFile(filePath, false)
              }
            } else {
              this.logger.debug(`Sending ${filePath} to Engine.`)
              await this.addFile(filePath, false)
            }
          } catch (error) {
            this.logger.error(error)
            return -1
          }
        } else {
          await this.addValues(formattedResults)
        }
        const oldLastCompletedAt = this.lastCompletedAt[scanMode]
        this.lastCompletedAt[scanMode] = updatedStartTime
        if (this.lastCompletedAt[scanMode] !== oldLastCompletedAt) {
          this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt[scanMode].toISOString()}`)
          await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
        } else {
          this.logger.debug(`No update for lastCompletedAt. Last value: ${this.lastCompletedAt[scanMode].toISOString()}`)
        }
      } else {
        this.logger.debug(`No result found between ${startTime.toISOString()} and ${endTime.toISOString()}`)
      }
    }
    return 0
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
    let results = null
    if (this.requestMethod === 'GET' && this.body) {
      const bodyToSend = this.body.replace(
        /@StartTime/g,
        this.variableDateFormat === 'ISO' ? new Date(startTime).toISOString() : new Date(startTime).getTime(),
      )
        .replace(
          /@EndTime/g,
          this.variableDateFormat === 'ISO' ? new Date(endTime).toISOString() : new Date(endTime).getTime(),
        )
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = bodyToSend.length
      const requestOptions = {
        method: this.requestMethod,
        agent: this.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null, // lgtm [js/disabling-certificate-validation]
        timeout: this.connectionTimeout,
        host: this.host,
        port: this.port,
        protocol: `${this.protocol}:`,
        path: this.endpoint,
        headers,
      }

      // eslint-disable-next-line max-len
      this.logger.info(`Requesting data ${this.authentication?.type ? `with ${this.authentication.type}` : 'without'} authentication and ${this.requestMethod} method: ${requestOptions.host}`)

      results = await requestWithBody(bodyToSend, requestOptions)
    } else {
      const fetchOptions = {
        method: this.requestMethod,
        headers,
        agent: this.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
        timeout: this.connectionTimeout,
      }
      const requestUrl = `${this.protocol}://${this.host}:${this.port}${this.endpoint}${this.formatQueryParams(startTime, endTime)}`

      if (this.body) {
        fetchOptions.body = this.body.replace(
          /@StartTime/g,
          this.variableDateFormat === 'ISO' ? new Date(startTime).toISOString() : new Date(startTime).getTime(),
        )
          .replace(
            /@EndTime/g,
            this.variableDateFormat === 'ISO' ? new Date(endTime).toISOString() : new Date(endTime).getTime(),
          )
      }
      // eslint-disable-next-line max-len
      this.logger.info(`Requesting data ${this.authentication?.type ? `with ${this.authentication.type}` : 'without'} authentication and ${this.requestMethod} method: ${requestUrl}`)

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
            value = this.variableDateFormat === 'ISO'
              ? new Date(startTime).toISOString() : new Date(startTime).getTime()
            break
          case '@EndTime':
            value = this.variableDateFormat === 'ISO'
              ? new Date(endTime).toISOString() : new Date(endTime).getTime()
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
