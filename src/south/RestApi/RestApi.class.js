const fs = require('node:fs/promises')
const path = require('node:path')

const fetch = require('node-fetch')
const https = require('https')

const humanizeDuration = require('humanize-duration')
const SouthConnector = require('../SouthConnector.class')
const { parsers, httpGetWithBody, formatQueryParams, generateCSV } = require('./utils')
const { replaceFilenameWithVariable, compress } = require('../../services/utils')

/**
 * Class RestApi - Retrieve data from REST API
 * The results are parsed through the available parsers
 */
class RestApi extends SouthConnector {
  static category = 'API'

  /**
   * Constructor for RestApi
   * @constructor
   * @param {Object} settings - The South connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine, {
      supportListen: false,
      supportLastPoint: false,
      supportFile: false,
      supportHistory: true,
    })

    this.canHandleHistory = true
    this.handlesFiles = true

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
    } = this.settings.RestApi

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
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp')
  }

  /**
   * Initialize services (logger, certificate, status data)
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    await super.init()

    // Create tmp folder to write files locally before sending them to the cache
    try {
      await fs.mkdir(this.tmpFolder, { recursive: true })
    } catch (mkdirError) {
      this.logger.error(mkdirError)
    }
  }

  /**
   * Retrieve result from a REST API write them into a CSV file and send it to the Engine.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<void>} - The result promise
   */
  async historyQuery(scanMode, startTime, endTime) {
    if (!parsers[this.payloadParser]) {
      throw new Error(`Parser "${this.payloadParser}" does not exist.`)
    }

    let updatedStartTime = startTime

    this.logger.debug(`Read from ${startTime.toISOString()} to ${endTime.toISOString()} (${endTime - startTime}ms)`)

    const requestStartTime = new Date().getTime()
    const results = await this.getDataFromRestApi(startTime, endTime)

    if (results) {
      let formattedResults = null
      try {
        // Use a formatter to format the retrieved data before converting it into CSV or adding values
        const { httpResults, latestDateRetrieved } = parsers[this.payloadParser](results)
        formattedResults = httpResults
        if (latestDateRetrieved > updatedStartTime) {
          updatedStartTime = latestDateRetrieved
        }
      } catch (parsingError) {
        this.logger.trace(`Parsing error with the results: ${results}.`)
        throw new Error(`Could not format the results with parser "${this.payloadParser}". Error: ${parsingError.message}`)
      }
      const requestFinishTime = new Date().getTime()
      this.logger.info(`Found and parsed ${formattedResults.length} results in ${humanizeDuration(requestFinishTime - requestStartTime)}.`)

      if (formattedResults.length > 0) {
        if (this.convertToCsv) {
          const fileName = replaceFilenameWithVariable(this.fileName, this.queryParts[scanMode], this.settings.name)
          const filePath = path.join(this.tmpFolder, fileName)

          this.logger.debug(`Converting HTTP payload to CSV file ${filePath}`)
          const csvContent = generateCSV(formattedResults, this.delimiter)

          this.logger.debug(`Writing CSV file at "${filePath}".`)
          await fs.writeFile(filePath, csvContent)

          if (this.compression) {
            // Compress and send the compressed file
            const gzipPath = `${filePath}.gz`
            await compress(filePath, gzipPath)

            try {
              await fs.unlink(filePath)
              this.logger.info(`File ${filePath} compressed and deleted.`)
            } catch (unlinkError) {
              this.logger.error(unlinkError)
            }

            this.logger.debug(`Sending compressed file "${gzipPath}" to Engine.`)
            await this.addFile(gzipPath, false)
          } else {
            this.logger.debug(`Sending file "${filePath}" to Engine.`)
            await this.addFile(filePath, false)
          }
        } else {
          await this.addValues(formattedResults)
        }

        const oldLastCompletedAt = this.lastCompletedAt[scanMode]
        this.lastCompletedAt[scanMode] = updatedStartTime
        if (this.lastCompletedAt[scanMode].getTime() !== oldLastCompletedAt.getTime()) {
          this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt[scanMode].toISOString()}.`)
          await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
        } else {
          this.logger.debug(`No update for lastCompletedAt. Last value: ${this.lastCompletedAt[scanMode].toISOString()}.`)
        }
      } else {
        this.logger.debug(`No result found between ${startTime.toISOString()} and ${endTime.toISOString()}.`)
      }
    }
  }

  /**
   * Get data from a REST API.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {Object} - The retrieved results
   */
  async getDataFromRestApi(startTime, endTime) {
    const headers = {}
    switch (this.authentication.type) {
      case 'Basic': {
        const decryptedPassword = this.encryptionService.decryptText(this.authentication.password)
        const basic = Buffer.from(`${this.authentication.username}:${decryptedPassword}`).toString('base64')
        headers.Authorization = `Basic ${basic}`
        break
      }
      case 'API Key': {
        headers[this.authentication.key] = this.encryptionService.decryptText(this.authentication.secretKey)
        break
      }
      case 'Bearer': {
        headers.Authorization = `Bearer ${this.encryptionService.decryptText(this.authentication.token)}`
        break
      }
      default:
        break
    }

    // Some API such as SLIMS uses a body with GET. It's not standard and requires a specific implementation
    if (this.requestMethod === 'GET' && this.body) {
      const bodyToSend = this.body
        .replace(
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

      this.logger.info(`Requesting data ${this.authentication.type ? `with ${this.authentication.type}` : 'without'} `
      + `authentication and ${this.requestMethod} method: "${requestOptions.host}".`)

      return httpGetWithBody(bodyToSend, requestOptions)
    }

    const fetchOptions = {
      method: this.requestMethod,
      headers,
      agent: this.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null, // lgtm [js/disabling-certificate-validation]
      timeout: this.connectionTimeout,
    }
    const requestUrl = `${this.protocol}://${this.host}:${this.port}${this.endpoint}${
      formatQueryParams(startTime, endTime, this.queryParams, this.variableDateFormat)}`

    if (this.body) {
      fetchOptions.body = this.body
        .replace(
          /@StartTime/g,
          this.variableDateFormat === 'ISO' ? new Date(startTime).toISOString() : new Date(startTime).getTime(),
        )
        .replace(
          /@EndTime/g,
          this.variableDateFormat === 'ISO' ? new Date(endTime).toISOString() : new Date(endTime).getTime(),
        )
      fetchOptions.headers['Content-Type'] = 'application/json'
      fetchOptions.headers['Content-Length'] = fetchOptions.body.length
    }

    this.logger.info(`Requesting data ${this.authentication?.type ? `with ${this.authentication.type}` : 'without'} `
          + `authentication and ${this.requestMethod} method: "${requestUrl}".`)

    const response = await fetch(requestUrl, fetchOptions)
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}.`)
    }
    return response.json()
  }
}

module.exports = RestApi
