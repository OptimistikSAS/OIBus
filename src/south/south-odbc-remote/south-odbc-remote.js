import fs from 'node:fs/promises'
import path from 'node:path'

import { DateTime } from 'luxon'
import humanizeDuration from 'humanize-duration'

import SouthConnector from '../south-connector.js'
import manifest from './manifest.js'
import { replaceFilenameWithVariable, compress } from '../../service/utils.js'
import SouthOdbcHttpClient from './south-odbc-http-client.js'

/**
 * Class SouthOdbcRemote - Retrieve data from remote ODBC agent.
 */
export default class SouthOdbcRemote extends SouthConnector {
  static category = manifest.category

  /**
   * Constructor for SouthOdbcRemote
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {ProxyService} proxyService - The proxy service
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxyService,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      proxyService,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      manifest,
    )

    const {
      connectionString,
      agentUrl,
      query,
      connectionTimeout,
      requestTimeout,
      filename,
      delimiter,
      timeColumn,
      datasourceTimestampFormat,
      datasourceTimezone,
      outputTimestampFormat,
      outputTimezone,
      compression,
      maxReadInterval,
      readIntervalDelay,
    } = configuration.settings

    this.connectionString = connectionString
    this.agentUrl = agentUrl
    this.query = query
    this.connectionTimeout = connectionTimeout
    this.timeColumn = timeColumn
    this.requestTimeout = requestTimeout
    this.filename = filename
    this.delimiter = delimiter
    this.compression = compression
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.datasourceTimestampFormat = datasourceTimestampFormat
    this.datasourceTimezone = datasourceTimezone
    this.outputTimestampFormat = outputTimestampFormat
    this.outputTimezone = outputTimezone
    this.httpClient = new SouthOdbcHttpClient(configuration.id, this.agentUrl, logger)
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName) {
    await super.start(baseFolder, oibusName)

    this.tmpFolder = path.resolve(this.baseFolder, 'tmp')
    // Create tmp folder to write files locally before sending them to the cache
    try {
      await fs.mkdir(this.tmpFolder, { recursive: true })
    } catch (mkdirError) {
      this.logger.error(mkdirError)
    }
  }

  /**
   * Call remote agent to create connection
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    try {
      this.logger.debug('Connecting to remote odbc...')
      const response = await this.httpClient.connect(this.connectionString, this.connectionTimeout)
      if (response.status === 200) {
        await super.connect()
        this.logger.debug('Connected to remote odbc...')
      } else if (response.status === 400) {
        const errorMessage = await response.text()
        this.logger.error(`Error occurred when sending connect command to remote agent with 
        status ${response.status} and error code ${errorMessage}`)
      } else {
        this.logger.error(`Error occurred when sending connect command to remote agent with status ${response.status}`)
      }
    } catch (e) {
      this.logger.error(`Error connecting to odbc remote agent for odbc remote data source ${e}`)
    }
  }

  /**
   * Call remote agent to disconnect the odbc remote agent from the data source
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    await this.httpClient.disconnect()
    await super.disconnect()
  }

  /**
   * Get entries from the odbc remote data source between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<void>} - The result promise
   */
  async historyQuery(scanMode, startTime, endTime) {
    if (!this.datasourceTimezone) {
      throw new Error(`Invalid timezone. Check the South "${this.id}" configuration.`)
    }

    const adaptedQuery = this.query
      .replace(/@StartTime/g, DateTime.fromJSDate(startTime, { zone: this.datasourceTimezone })
        .toFormat(this.datasourceTimestampFormat, { locale: 'en-US' }).toUpperCase())
      .replace(/@EndTime/g, DateTime.fromJSDate(endTime, { zone: this.datasourceTimezone })
        .toFormat(this.datasourceTimestampFormat, { locale: 'en-US' }).toUpperCase())

    this.logQuery(adaptedQuery, startTime, endTime)

    const requestStartTime = new Date().getTime()

    const response = await this.httpClient.read(
      this.connectionString,
      adaptedQuery,
      this.requestTimeout,
      this.timeColumn,
      this.datasourceTimestampFormat,
      this.datasourceTimezone,
      this.delimiter,
      this.outputTimestampFormat,
      this.outputTimezone,
    )

    if (response.status === 200) {
      const result = await response.json()
      const requestFinishTime = new Date().getTime()
      this.logger.info(`Found ${result.recordCount} results in ${humanizeDuration(requestFinishTime - requestStartTime)}.`)

      if (result.recordCount > 0) {
        const filename = replaceFilenameWithVariable(this.filename, this.queryParts[scanMode], this.name)
        const filePath = path.join(this.tmpFolder, filename)

        this.logger.debug(`Writing CSV file at "${filePath}".`)
        await fs.writeFile(filePath, result.content)

        if (this.compression) {
          // Compress and send the compressed file
          const gzipPath = `${filePath}.gz`
          await compress(filePath, gzipPath)

          try {
            await fs.unlink(filePath)
            this.logger.info(`File "${filePath}" compressed and deleted.`)
          } catch (unlinkError) {
            this.logger.error(unlinkError)
          }

          this.logger.debug(`Sending compressed file "${gzipPath}" to Engine.`)
          await this.addFile(gzipPath, false)
        } else {
          this.logger.debug(`Sending file "${filePath}" to Engine.`)
          await this.addFile(filePath, false)
        }

        if (result.maxInstantRetrieved) {
          const newMaxInstant = DateTime.fromISO(result.maxInstantRetrieved).toJSDate()
          if (newMaxInstant > this.lastCompletedAt[scanMode]) {
            this.lastCompletedAt[scanMode] = newMaxInstant
            this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt[scanMode].toISOString()}.`)
            this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
          } else {
            this.logger.debug(`No update for lastCompletedAt. Last value: ${this.lastCompletedAt[scanMode].toISOString()}.`)
          }
        }
      } else {
        this.logger.debug('No result found.')
      }
    } else if (response.status === 400) {
      const errorMessage = await response.text()
      this.logger.error(`Error occurred when querying  remote agent with 
        status ${response.status} and error code ${errorMessage}`)
    } else {
      this.logger.error(`Error occurred when connecting to remote agent with status ${response.status}`)
    }
  }

  /**
   * Log the executed query with replacements values for query variables
   * @param {String} query - The query
   * @param {Date} startTime - The replaced StartTime
   * @param {Date} endTime - The replaced EndTime
   * @returns {void}
   */
  logQuery(query, startTime, endTime) {
    const startTimeLog = query.indexOf('@StartTime') !== -1 ? `StartTime = ${startTime.toISOString()}` : ''
    const endTimeLog = query.indexOf('@EndTime') !== -1 ? `EndTime = ${endTime.toISOString()}` : ''
    this.logger.info(`Executing "${query}" with ${startTimeLog} ${endTimeLog}`)
    this.statusService.updateStatusDataStream({ 'Last request': `"${query}" with ${startTimeLog} ${endTimeLog}` })
  }
}
