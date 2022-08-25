const fs = require('fs')
const zlib = require('zlib')
const EventEmitter = require('events')
const { DateTime } = require('luxon')

const EncryptionService = require('../services/EncryptionService.class')
const databaseService = require('../services/database.service')
const Logger = require('../engine/logger/Logger.class')
const CertificateService = require('../services/CertificateService.class')

const COMPRESSION_LEVEL = 9

/**
 * Class Protocol : provides general attributes and methods for protocols.
 * Building a new South Protocol means to extend this class, and to surcharge
 * the following methods:
 * - **onScan**: will be called by the engine each time a scanMode is scheduled. it receive the "scanmode" name.
 * so the driver will be able to look at **this.dataSource** that contains all parameters for this
 * dataSource including the points to be queried, the informations to connect to the data source, etc.... It's up to
 * the driver to decide if additional structure (such as scanGroups for OPCHDA) need to be initialized in the
 * constructor to simplify or optimize the onScan method.
 * - **listen**: A special scanMode can be created for a protocol (for example MQTT). In this configuration, the
 * driver will be able to "listen" for updated values.
 * - **connect**: to allow to establish proper connection to the data source(optional)
 * - **disconnect**: to allow proper disconnection (optional)
 * In addition, it is possible to use a number of helper functions:
 * - **addValues**: is an **important** mmethod to be used in **onScan** or **Listen**. This will allow to push an array
 * of values
 * - **addFile**: is the equivalent of addValues but for a file.
 * to the OIBus engine. More details on the Engine class.
 * - **logger**: to log an event with different levels (error,warning,info,debug)
 *
 * All other operations (cache, store&forward, communication to North applications) will be
 * handled by the OIBus engine and should not be taken care at the South level.
 *
 */
class ProtocolHandler {
  /**
   * Constructor for Protocol
   * @constructor
   * @param {*} dataSource - The data source
   * @param {BaseEngine} engine - The engine
   * @param {object} supportedModes - The supported modes
   * @return {void}
   */
  constructor(dataSource, engine, supportedModes) {
    this.dataSource = dataSource
    this.engine = engine
    this.encryptionService = EncryptionService.getInstance()
    const { engineConfig } = this.engine.configService.getConfig()
    this.engineConfig = engineConfig
    this.supportedModes = supportedModes

    this.connected = false

    this.addFileCount = 0
    this.addPointsCount = 0
    this.statusData = {}

    this.currentlyOnScan = {}
    this.buffer = []
    this.bufferTimeout = null

    this.keyFile = null
    this.certFile = null
    this.caFile = null
  }

  checkSupportedModes() {
    const {
      supportListen,
      supportLastPoint,
      supportFile,
      supportHistory,
    } = this.supportedModes
    if (!supportListen && !supportLastPoint && !supportFile && !supportHistory) {
      this.logger.error(`${this.constructor.name} should support at least 1 operation mode.`)
    }
    if (supportListen && typeof this.listen !== 'function') {
      this.logger.error(`${this.constructor.name} should implement the listen() method.`)
    }
    if (supportLastPoint && typeof this.lastPointQuery !== 'function') {
      this.logger.error(`${this.constructor.name} should implement the lastPointQuery() method.`)
    }
    if (supportFile && typeof this.fileQuery !== 'function') {
      this.logger.error(`${this.constructor.name} should implement the fileQuery() method.`)
    }
    if (supportHistory && typeof this.historyQuery !== 'function') {
      this.logger.error(`${this.constructor.name} should implement the historyQuery() method.`)
    }

    if (this.handlesPoints) {
      this.statusData['Number of values since OIBus has started'] = 0
    }
    if (this.handlesFiles) {
      this.statusData['Number of files since OIBus has started'] = 0
    }
  }

  prepareHistorySupport() {
    this.lastCompletedAt = {}
    this.queryParts = {}
    this.ongoingReads = {} // each scanMode will have a value equal to True if a read is ongoing
    this.ignoredReadsCounters = {} // each scanMode will maintain a counter on the number of ignored reads
    if (this.dataSource.scanMode) {
      this.lastCompletedAt[this.dataSource.scanMode] = new Date().getTime()
      this.queryParts[this.dataSource.scanMode] = 0
      this.ongoingReads[this.dataSource.scanMode] = false
    } else if (this.dataSource[this.constructor.name].scanGroups) {
      // Group all points in their respective scanGroup
      // Each scanGroup is also initialized with a default "last completed date" equal to current Time
      this.scanGroups = this.dataSource[this.constructor.name].scanGroups.map((scanGroup) => {
        const points = this.dataSource.points.filter((point) => point.scanMode === scanGroup.scanMode)
        this.lastCompletedAt[scanGroup.scanMode] = new Date().getTime()
        this.queryParts[scanGroup.scanMode] = 0
        this.ongoingReads[scanGroup.scanMode] = false
        return {
          name: scanGroup.scanMode,
          ...scanGroup,
          points,
        }
      })
    } else {
      this.logger.error(`${this.dataSource.name} scanGroups are not defined. This South driver will not work`)
      this.scanGroups = []
    }
  }

  async init() {
    const { logParameters } = this.dataSource
    this.logger = new Logger(`South:${this.dataSource.name}`)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(this.engineConfig, logParameters)
    if (this.supportedModes) {
      this.checkSupportedModes()
      if (this.supportedModes.supportHistory) {
        this.prepareHistorySupport()
      }
    }

    this.certificate = new CertificateService(this.logger)
    await this.certificate.init(this.keyFile, this.certFile, this.caFile)
    this.initializeStatusData()
  }

  async connect() {
    const {
      id,
      name,
      protocol,
      startTime,
    } = this.dataSource

    const databasePath = `${this.engine.getCacheFolder()}/${id}.db`
    this.southDatabase = databaseService.createConfigDatabase(databasePath)

    if (this.supportedModes?.supportHistory) {
      // Initialize lastCompletedAt for every scanMode
      // "startTime" is set from HistoryQuery or can be a "hidden" parameter of oibus.json
      const defaultLastCompletedAt = startTime ? new Date(startTime) : new Date()

      // Disable ESLint check because we need for..of loop to support async calls
      // eslint-disable-next-line no-restricted-syntax
      for (const scanMode of Object.keys(this.lastCompletedAt)) {
        // Disable ESLint check because we want to get the values one by one to avoid parallel access to the SQLite database
        // eslint-disable-next-line no-await-in-loop
        const lastCompletedAt = await this.getConfig(`lastCompletedAt-${scanMode}`)
        // eslint-disable-next-line no-await-in-loop
        const queryPart = await this.getConfig(`queryPart-${scanMode}`)
        this.lastCompletedAt[scanMode] = lastCompletedAt ? new Date(lastCompletedAt) : defaultLastCompletedAt
        this.queryParts[scanMode] = queryPart ? parseInt(queryPart, 10) : 0
        this.logger.info(`Initializing lastCompletedAt for ${scanMode} with ${this.lastCompletedAt[scanMode]}`)
      }
    }

    this.logger.info(`Data source ${name} (${id}) started with protocol ${protocol}`)
  }

  initializeStatusData() {
    if (!this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`]) {
      this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`] = {}
    } else {
      this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`].events.removeAllListeners()
      this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`].stream?.destroy()
    }
    this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`].events = new EventEmitter()
    this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`].events.on('data', this.listener)
    this.updateStatusDataStream()
  }

  /**
   * Method used by the eventEmitter of the current protocol to write data to the socket and send them to the frontend
   * @param {object} data - The json object of data to send
   * @return {void}
   */
  listener = (data) => {
    if (data) {
      this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`]?.stream?.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  updateStatusDataStream(statusData = {}) {
    this.statusData = { ...this.statusData, ...statusData }
    this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`].statusData = this.statusData
    this.engine.eventEmitters[`/south/${this.dataSource.id}/sse`]?.events?.emit('data', this.statusData)
  }

  async historyQueryHandler(scanMode) {
    if (!this.connected || this.ongoingReads[scanMode]) {
      this.ignoredReadsCounters[scanMode] += 1
      // eslint-disable-next-line max-len
      this.logger.debug(`onScan ignored (counter= ${this.ignoredReadsCounters[scanMode]}): connected: ${this.connected}, ongoingReads[${scanMode}]: ${this.ongoingReads[scanMode]}`)
      return
    }
    this.ignoredReadsCounters[scanMode] = 0 // reset the counter as the read is not ignored.

    if (this.dataSource[this.constructor.name].scanGroups) {
      const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)

      if (!scanGroup) {
        this.logger.error(`onScan ignored: no scanGroup for ${scanMode}`)
        return
      }

      if (!scanGroup.points || !scanGroup.points.length) {
        this.logger.error(`onScan ignored: scanGroup.points undefined or empty: ${scanGroup.points}`)
        return
      }
    }

    this.ongoingReads[scanMode] = true
    let startTime = this.lastCompletedAt[scanMode]
    const endTime = new Date()
    let intervalEndTime
    let firstIteration = true
    do {
      // Wait between the read interval iterations to give time for the Cache to store the data from the previous iteration
      if (!firstIteration) {
        this.logger.trace(`Wait ${this.readIntervalDelay} ms`)
        // eslint-disable-next-line no-await-in-loop
        await this.delay(this.readIntervalDelay)
      }

      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests (for example only one hour if maxReadInterval is 3600)
      if (this.maxReadInterval > 0 && (endTime.getTime() - startTime.getTime()) > 1000 * this.maxReadInterval) {
        intervalEndTime = new Date(startTime.getTime() + 1000 * this.maxReadInterval)
      } else {
        intervalEndTime = endTime
      }

      // eslint-disable-next-line no-await-in-loop
      const historyQueryResult = await this.historyQuery(scanMode, startTime, intervalEndTime)

      if (historyQueryResult === -1) {
        this.logger.error(`Error while retrieving data. Exiting historyQueryHandler. queryPart-${scanMode}: ${
          this.queryParts[scanMode]}, startTime: ${startTime.toISOString()}, intervalEndTime: ${intervalEndTime.toISOString()}`)
        this.ongoingReads[scanMode] = false
        return
      }

      this.queryParts[scanMode] += 1
      // eslint-disable-next-line no-await-in-loop
      await this.setConfig(`queryPart-${scanMode}`, this.queryParts[scanMode])

      startTime = intervalEndTime
      firstIteration = false
    } while (intervalEndTime !== endTime)
    this.queryParts[scanMode] = 0
    await this.setConfig(`queryPart-${scanMode}`, this.queryParts[scanMode])
    this.ongoingReads[scanMode] = false
  }

  async onScan(scanMode) {
    this.logger.debug(`${this.constructor.name} activated on scanMode: ${scanMode}.`)
    this.currentlyOnScan[scanMode] ??= 0 // initialize if undefined
    if (this.currentlyOnScan[scanMode] === 0) {
      this.currentlyOnScan[scanMode] = 1
      this.updateStatusDataStream({ 'Last scan at': new Date().toLocaleString() })
      try {
        if (this.supportedModes?.supportLastPoint) {
          await this.lastPointQuery(scanMode)
        }
        if (this.supportedModes?.supportFile) {
          await this.fileQuery(scanMode)
        }
        if (this.supportedModes?.supportHistory) {
          await this.historyQueryHandler(scanMode)
        }
      } catch (error) {
        this.logger.error(`${this.dataSource.name} on scan error: ${error}.`)
      }
      this.currentlyOnScan[scanMode] = 0
    } else {
      this.currentlyOnScan[scanMode] += 1
      this.logger.warn(`${this.dataSource.name} currently on scan = ${
        this.currentlyOnScan[scanMode]}. Skipping it. Maybe the duration of scanMode (${scanMode}) should be increased`)
    }
  }

  async disconnect() {
    const {
      name,
      id,
    } = this.dataSource
    this.connected = false
    this.updateStatusDataStream({ 'Connected at': 'Not connected' })
    this.logger.info(`Data source ${name} (${id}) disconnected`)
    this.engine.eventEmitters[`/south/${id}/sse`]?.events?.removeAllListeners()
    this.engine.eventEmitters[`/south/${id}/sse`]?.stream?.destroy()
  }

  /**
   * Method used to flush the buffer from a time trigger or a max trigger
   * @param {string} flag - The trigger
   * @returns {void} -
   */
  async flush(flag = 'time-flush') {
    this.logger.trace(`${flag}: ${this.buffer.length}, ${this.dataSource.name}`)
    // save the buffer to be sent and immediately clear it
    const bufferSave = [...this.buffer]
    this.buffer = []
    await this.engine.addValues(this.dataSource.id, bufferSave)

    if (bufferSave.length > 0) {
      this.addPointsCount += bufferSave.length
      this.updateStatusDataStream({
        'Number of values since OIBus has started': this.addPointsCount,
        'Last added points at': new Date().toLocaleString(),
        'Last added point id (value)': `${bufferSave[bufferSave.length - 1].pointId} (${JSON.stringify(bufferSave[bufferSave.length - 1].data)})`,
      })
    }

    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
      this.bufferTimeout = null
    }
  }

  /**
   * Add a new Value to the Engine.
   * @param {array} values - The new value
   * @return {void}
   */
  async addValues(values) {
    // add new values to the protocol buffer
    this.buffer.push(...values)
    // if the protocol buffer is large enough, send it
    // else start a timer before sending it
    if (this.buffer.length > this.engine.bufferMax) {
      await this.flush('max-flush')
    } else if (this.bufferTimeout === null) {
      this.bufferTimeout = setTimeout(async () => {
        await this.flush()
      }, this.engine.bufferTimeoutInterval)
    }
  }

  /**
   * Add a new File to the Engine.
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the original file
   * @return {void}
   */
  addFile(filePath, preserveFiles) {
    this.addFileCount += 1
    this.updateStatusDataStream({
      'Number of files since OIBus has started': this.addFileCount,
      'Last added file at': new Date().toLocaleString(),
      'Last added file': filePath,
    })

    this.engine.addFile(this.dataSource.id, filePath, preserveFiles)
  }

  /**
   * Compress the specified file
   * @param {string} input - The path of the file to compress
   * @param {string} output - The path to the compressed file
   * @returns {Promise} - The compression result
   */
  // eslint-disable-next-line class-methods-use-this
  compress(input, output) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(input)
      const writeStream = fs.createWriteStream(output)
      const gzip = zlib.createGzip({ level: COMPRESSION_LEVEL })
      readStream
        .pipe(gzip)
        .pipe(writeStream)
        .on('error', (error) => {
          reject(error)
        })
        .on('finish', () => {
          resolve()
        })
    })
  }

  /**
   * Read a given key in the config db of the protocol handler
   * @param {string} configKey - key to retrieve
   * @returns {Promise<string>} - The value of the key
   */
  async getConfig(configKey) {
    return databaseService.getConfig(this.southDatabase, configKey)
  }

  /**
   * Update or add a given key in the config db of the protocol handler
   * @param {string} configKey - key to update/add
   * @param {string} value - value of the key
   * @returns {Promise} - the value to update the key
   */
  async setConfig(configKey, value) {
    return databaseService.upsertConfig(
      this.southDatabase,
      configKey,
      value,
    )
  }

  /**
   * Decompress the specified file
   * @param {string} input - The path of the compressed file
   * @param {string} output - The path to the decompressed file
   * @returns {Promise} - The decompression result
   */
  /* eslint-disable-next-line class-methods-use-this */
  decompress(input, output) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(input)
      const writeStream = fs.createWriteStream(output)
      const gunzip = zlib.createGunzip()
      readStream
        .pipe(gunzip)
        .pipe(writeStream)
        .on('error', (error) => {
          reject(error)
        })
        .on('finish', () => {
          resolve()
        })
    })
  }

  /**
   * Method to return a delayed promise.
   * @param {number} timeout - The delay
   * @return {Promise<any>} - The delay promise
   */

  /* eslint-disable-next-line class-methods-use-this */
  async delay(timeout) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeout)
    })
  }

  /**
   * Get timestamp.
   * @param {string} elementTimestamp - The element timestamp
   * @param {string} timestampOrigin - The timestamp origin
   * @param {string} timestampFormat - The timestamp format
   * @param {string} timezone - The timezone
   * @return {string} - The timestamp
   */
  getTimestamp(elementTimestamp, timestampOrigin, timestampFormat, timezone) {
    let timestamp = new Date().toISOString()

    if (timestampOrigin === 'payload') {
      if (timezone && elementTimestamp) {
        timestamp = ProtocolHandler.generateDateWithTimezone(elementTimestamp, timezone, timestampFormat)
      } else {
        this.logger.error('Invalid timezone specified or the timestamp key is missing in the payload')
      }
    }

    return timestamp
  }

  /**
   * Replace the variables such as @CurrentDate in the file name with their values
   * @param {string} filename - The filename to change
   * @param {number} queryPart - The part of the query being executed
   * @return {string} newFilename - The renamed file name
   */
  replaceFilenameWithVariable(filename, queryPart) {
    return filename.replace('@CurrentDate', DateTime.local()
      .toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      .replace('@ConnectorName', `${this.dataSource.name}`)
      .replace('@QueryPart', `${queryPart}`)
  }

  /**
   * Generate date based on the configured format taking into account the timezone configuration.
   * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
   * @param {string} date - The date to parse and format
   * @param {string} timezone - The timezone to use to replace the timezone of the date
   * @param {string} dateFormat - The format of the date
   * @returns {string} - The formatted date with timezone
   */
  static generateDateWithTimezone(date, timezone, dateFormat) {
    if (DateTime.fromISO(date).isValid) {
      return date
    }
    return DateTime.fromFormat(date, dateFormat, { zone: timezone }).toJSDate().toISOString()
  }
}

module.exports = ProtocolHandler
