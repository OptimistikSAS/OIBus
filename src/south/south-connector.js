const path = require('node:path')
const EncryptionService = require('../service/encryption.service')
const databaseService = require('../service/database.service')
const LoggerService = require('../service/logger/logger.service')
const CertificateService = require('../service/certificate.service')
const StatusService = require('../service/status.service')
const { generateIntervals, delay, createFolder } = require('../service/utils')

const CACHE_DB_FILE_NAME = 'cache.db'

const BUFFER_MAX = 250
const BUFFER_TIMEOUT = 300

/**
 * Class SouthConnector : provides general attributes and methods for south connectors.
 * Building a new South connector means to extend this class, and to surcharge the following methods:
 * - **historyQuery**: receives a scanMode, a startTime and an endTime. Interval split can occur in this class. The
 * main logic must be developed in the surcharged method.
 * - **lastPointQuery**: receives a scanMode. The main logic must be developed in the surcharged method.
 * - **fileQuery**:  receives a scanMode. The main logic must be developed in the surcharged method.
 * - **listen**: A special scanMode is used (for example with MQTT). In this configuration, the  driver will be able
 * to "listen" for updated values.
 * - **connect** (optional): to establish proper connection to the South connector
 * - **disconnect** (optional): to disconnect
 *
 * In addition, it is possible to use a number of helper functions:
 * - **addValues**: is an **important** method to be used when retrieving values. This will allow to push an array
 * of values to the engine to cache them
 * - **addFile**: is the equivalent of addValues but for a file.
 * - **logger**: to log an event with different levels (error,warning,info,debug,trace).
 *
 * All other operations (cache, store&forward, communication to North connectors) will be handled by the OIBus engine
 * and should not be taken care at the South level.
 */
class SouthConnector {
  /**
   * Constructor for SouthConnector
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {Function} engineAddValues - The Engine add values method
   * @param {Function} engineAddFiles - The Engine add file method
   * @param {Object} supportedModes - The supported modes
   * @return {void}
   */
  constructor(
    configuration,
    engineAddValues,
    engineAddFiles,
    supportedModes = {},
  ) {
    this.handlesPoints = false
    this.handlesFiles = false
    this.engineAddValues = engineAddValues
    this.engineAddFiles = engineAddFiles
    this.connected = false

    this.id = configuration.id
    this.type = configuration.type
    this.name = configuration.name
    this.logParameters = configuration.logParameters
    this.startTime = configuration.startTime
    this.scanMode = configuration.scanMode
    this.points = configuration.points
    this.scanGroups = configuration.settings.scanGroups

    this.encryptionService = EncryptionService.getInstance()
    this.supportedModes = supportedModes

    this.numberOfRetrievedFiles = 0
    this.numberOfRetrievedValues = 0
    this.currentlyOnScan = {}

    this.ignoredReadsCounters = {}
    this.queryParts = {}
    this.buffer = []
    this.bufferTimeout = null

    // Variable initialized in init()
    this.baseFolder = null
    this.statusService = null
    this.keyFile = null
    this.certFile = null
    this.caFile = null
    this.readIntervalDelay = 0
    this.maxReadInterval = 0
    this.maxQueryPart = 0
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @param {Object} defaultLogParameters - The default logs parameters
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName, defaultLogParameters) {
    this.baseFolder = path.resolve(baseFolder, `south-${this.id}`)

    this.statusService = new StatusService()

    this.logger = new LoggerService(`South:${this.name}`)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(oibusName, defaultLogParameters, this.logParameters)

    this.certificate = new CertificateService(this.logger)
    await this.certificate.init(this.keyFile, this.certFile, this.caFile)

    await createFolder(this.baseFolder)
    this.southDatabase = databaseService.createConfigDatabase(path.resolve(this.baseFolder, CACHE_DB_FILE_NAME))

    const {
      supportListen,
      supportLastPoint,
      supportFile,
      supportHistory,
    } = this.supportedModes

    // Each scanMode will maintain a counter on the number of ignored reads
    this.currentlyOnScan = {}
    this.ignoredReadsCounters = {}
    this.queryParts = {}
    this.lastCompletedAt = {}

    // Initialize lastCompletedAt for every scanMode
    // "startTime" is a "hidden" parameter of oibus.json
    const defaultLastCompletedAt = this.startTime ? new Date(this.startTime) : new Date()

    if (this.scanMode) {
      // Retrieve associated lastCompletedAt and queryPart from the cache
      const lastCompletedAt = this.getConfig(`lastCompletedAt-${this.scanMode}`)
      const queryPart = this.getConfig(`queryPart-${this.scanMode}`)

      this.lastCompletedAt[this.scanMode] = lastCompletedAt ? new Date(lastCompletedAt) : defaultLastCompletedAt
      this.queryParts[this.scanMode] = parseInt(queryPart || '0', 10)
      this.ignoredReadsCounters[this.scanMode] = 0
      this.currentlyOnScan[this.scanMode] = 0
      this.logger.info(`Initializing lastCompletedAt for ${this.scanMode} `
          + `with ${this.lastCompletedAt[this.scanMode].toISOString()}.`)
    } else if (this.scanGroups?.length > 0) {
      // Group all points in their respective scanGroup
      this.scanGroups = this.scanGroups
        .filter((scanGroup) => this.points.filter((point) => point.scanMode === scanGroup.scanMode).length > 0)
        .map((scanGroup) => {
        // Retrieve associated lastCompletedAt and queryPart from the cache
          const lastCompletedAt = this.getConfig(`lastCompletedAt-${scanGroup.scanMode}`)
          const queryPart = this.getConfig(`queryPart-${scanGroup.scanMode}`)

          // Retrieve the points with the associated scanMode
          const points = this.points.filter((point) => point.scanMode === scanGroup.scanMode)

          this.lastCompletedAt[scanGroup.scanMode] = lastCompletedAt ? new Date(lastCompletedAt) : defaultLastCompletedAt
          this.queryParts[scanGroup.scanMode] = parseInt(queryPart || '0', 10)
          this.ignoredReadsCounters[scanGroup.scanMode] = 0
          this.currentlyOnScan[scanGroup.scanMode] = 0
          this.logger.info(`Initializing lastCompletedAt for ${scanGroup.scanMode} `
            + `with ${this.lastCompletedAt[scanGroup.scanMode].toISOString()}.`)

          return {
            name: scanGroup.scanMode,
            ...scanGroup,
            points,
          }
        })
    } else if (this.points) {
      this.points.forEach(({ scanMode }) => {
        if (this.queryParts[scanMode] === undefined && scanMode !== 'listen') {
          // Retrieve associated lastCompletedAt and queryPart from the cache
          const lastCompletedAt = this.getConfig(`lastCompletedAt-${scanMode}`)
          const queryPart = this.getConfig(`queryPart-${scanMode}`)

          this.lastCompletedAt[scanMode] = lastCompletedAt || defaultLastCompletedAt
          this.queryParts[scanMode] = parseInt(queryPart || '0', 10)
          this.ignoredReadsCounters[scanMode] = 0
          this.currentlyOnScan[scanMode] = 0
        }
      })
    } else {
      this.logger.error(`Scan mode or scan groups for South "${this.name}" are not defined.`
          + 'This South connector will not work.')
      this.scanGroups = []
    }

    if (!supportListen && !supportLastPoint && !supportFile && !supportHistory) {
      this.logger.error(`${this.type} should support at least 1 operation mode.`)
    }
    if (supportListen && typeof this.listen !== 'function') {
      this.logger.error(`${this.type} should implement the listen() method.`)
    }
    if (supportLastPoint && typeof this.lastPointQuery !== 'function') {
      this.logger.error(`${this.type} should implement the lastPointQuery() method.`)
    }
    if (supportFile && typeof this.fileQuery !== 'function') {
      this.logger.error(`${this.type} should implement the fileQuery() method.`)
    }
    if (supportHistory && typeof this.historyQuery !== 'function') {
      this.logger.error(`${this.type} should implement the historyQuery() method.`)
    }

    this.statusService.updateStatusDataStream({
      'Number of values since OIBus has started': this.handlesPoints ? 0 : undefined,
      'Number of files since OIBus has started': this.handlesFiles ? 0 : undefined,
    })
    this.logger.info(`South connector "${this.name}" (${this.id}) of type ${this.type} started.`)
  }

  /**
   * Stop services and timer
   * @returns {Promise<void>} - The result promise
   */
  async stop() {
    this.logger.info(`Stopping South "${this.name}" (${this.id}).`)
    await this.disconnect()
  }

  /**
   * Method called by Engine to initialize a South connector. This method can be surcharged in the
   * South connector implementation to allow connection to a third party application for example.
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    this.connected = true
    this.statusService.updateStatusDataStream({ 'Connected at': new Date().toISOString() })
  }

  /**
   * Method used to manage history queries of a South connector. If needed, a query interval will be split
   * @param {String} scanMode - The scan mode to activate
   * @param {Date} historyStartTime - The start time of the history query
   * @param {Date} historyEndTime - The end time of the history query
   *                -set to now in OIBus Engine data stream
   *                -set to a specific time in HistoryQueryEngine
   * @returns {Promise<void>} - The result promise
   */
  async historyQueryHandler(scanMode, historyStartTime, historyEndTime) {
    // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
    // requests. For example only one hour if maxReadInterval is 3600 (in s)
    const intervals = generateIntervals(historyStartTime, historyEndTime, this.maxReadInterval)
    this.maxQueryPart = intervals.length

    const intervalToKeep = this.maxQueryPart - this.queryParts[scanMode]
    const intervalsToQuery = intervals.slice(-intervalToKeep)
    if (intervals.length > 2) {
      this.logger.trace(`Interval split in ${intervals.length} sub-intervals: \r\n`
          + `[${JSON.stringify(intervals[0], null, 2)}\r\n`
          + `${JSON.stringify(intervals[1], null, 2)}\r\n`
          + '...\r\n'
          + `${JSON.stringify(intervals[intervals.length - 1], null, 2)}]`)
      this.logger.trace(`Take back to interval number ${this.queryParts[scanMode]}: \r\n`
          + `${JSON.stringify(intervalsToQuery[0], null, 2)}\r\n`)
    } else if (intervals.length === 2) {
      this.logger.trace(`Interval split in ${intervals.length} sub-intervals: \r\n`
          + `[${JSON.stringify(intervals[0], null, 2)}\r\n`
          + `${JSON.stringify(intervals[1], null, 2)}]`)
      this.logger.trace(`Take back to interval number ${this.queryParts[scanMode]}: \r\n`
          + `${JSON.stringify(intervalsToQuery[0], null, 2)}\r\n`)
    } else {
      this.logger.trace(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`)
    }

    // Map each interval to a history query and run each query sequentially
    await intervalsToQuery.reduce((promise, { startTime, endTime }) => promise.then(
      async () => this.querySpecificInterval(
        scanMode,
        startTime,
        endTime,
        endTime.getTime() === historyEndTime.getTime(),
      ),
    ), Promise.resolve())
  }

  /**
   * Run a query for a single interval
   * @param {String} scanMode - The scan mode to activate
   * @param {Date} startTime - The start of the interval
   * @param {Date} endTime - The end of the interval
   * @param {Boolean} last - Is it the last interval or not
   * @returns {Promise<void>} - The result promise
   */
  async querySpecificInterval(scanMode, startTime, endTime, last) {
    await this.historyQuery(scanMode, startTime, endTime)

    this.queryParts[scanMode] += 1
    this.setConfig(`queryPart-${scanMode}`, this.queryParts[scanMode])

    if (!last) {
      await delay(this.readIntervalDelay)
    }
  }

  /**
   * @param {String} scanMode - The scan mode to activate
   * Method called by Engine to retrieve data from a South connector. This method calls the appropriate implementation
   * (lastQueryPoint, fileQuery, historyQuery) according to the South connector configuration and properties.
   * @returns {Promise<void>} - The result promise
   */
  async onScan(scanMode) {
    this.logger.debug(`South "${this.name}" activated on scanMode: "${scanMode}".`)

    if (!this.connected) {
      this.ignoredReadsCounters[scanMode] += 1
      this.logger.debug(`South "${this.name}" not connected. Scan ignored `
          + `${this.ignoredReadsCounters[scanMode]} times.`)
      return
    }
    if (this.currentlyOnScan[scanMode] !== 0) {
      this.currentlyOnScan[scanMode] += 1
      this.logger.warn(`South "${this.name}" already scanning for scan mode "${scanMode}" since `
          + `${this.currentlyOnScan[scanMode]} scans.`)
      return
    }

    // Check if scan mode exists in scan groups if scan groups are defined
    if (this.scanGroups?.length > 0) {
      const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)

      if (!scanGroup) {
        this.logger.error(`South "${this.name}" has no scan group for scan mode "${scanMode}".`)
        return
      }

      if (!scanGroup.points || !scanGroup.points.length) {
        this.logger.error(`South "${this.name}" has no point associated to the scan group "${scanMode}".`)
        return
      }
    }

    this.currentlyOnScan[scanMode] += 1
    this.statusService.updateStatusDataStream({ 'Last scan at': new Date().toISOString() })
    try {
      if (this.supportedModes.supportLastPoint) {
        await this.lastPointQuery(scanMode)
      }
      if (this.supportedModes.supportFile) {
        await this.fileQuery(scanMode)
      }
      if (this.supportedModes.supportHistory) {
        await this.historyQueryHandler(scanMode, this.lastCompletedAt[scanMode], new Date())
        this.queryParts[scanMode] = 0
      }
    } catch (error) {
      this.logger.error(`South "${this.name}" onScan failed for scan mode "${scanMode}": ${error}.`)
    }

    this.ignoredReadsCounters[scanMode] = 0
    this.currentlyOnScan[scanMode] = 0
  }

  /**
   * Method called by Engine to stop a South connector. This method can be surcharged in the
   * South connector implementation to allow disconnecting to a third party application for example.
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    this.connected = false
    Object.keys(this.currentlyOnScan).forEach((scanMode) => {
      this.currentlyOnScan[scanMode] = 0
      this.queryParts[scanMode] = 0
    })
    this.statusService.updateStatusDataStream({ 'Connected at': 'Not connected' })
    this.logger.info(`South connector "${this.name}" (${this.id}) disconnected.`)
  }

  /**
   * Method used to flush the buffer from a time trigger or a max trigger
   * @param {'time-flush' | 'max-flush'} flag - The trigger
   * @returns {Promise<void>} - The result promise
   */
  async flush(flag = 'time-flush') {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
      this.bufferTimeout = null
    }

    this.logger.trace(`Flush ${this.buffer.length} values (${flag}) for South "${this.name}".`)
    // Save the buffer to be sent and immediately clear it
    const bufferSave = [...this.buffer]
    this.buffer = []
    if (bufferSave.length > 0) {
      await this.engineAddValues(this.id, bufferSave)
      this.numberOfRetrievedValues += bufferSave.length
      this.statusService.updateStatusDataStream({
        'Number of values since OIBus has started': this.numberOfRetrievedValues,
        'Last added points at': new Date().toISOString(),
        'Last added point id (value)': `${bufferSave[bufferSave.length - 1].pointId} (${JSON.stringify(bufferSave[bufferSave.length - 1].data)})`,
      })
    }
  }

  /**
   * Add new values to the South connector buffer.
   * @param {Object[]} values - The new values
   * @returns {Promise<void>} - The result promise
   */
  async addValues(values) {
    this.buffer.push(...values)
    // If the South connector buffer is larger than bufferMax flush the buffer
    // Otherwise, start a timer before sending it
    if (this.buffer.length > BUFFER_MAX) {
      await this.flush('max-flush')
    } else if (this.bufferTimeout === null) {
      this.bufferTimeout = setTimeout(this.flush.bind(this), BUFFER_TIMEOUT)
    }
  }

  /**
   * Add a new file to the Engine.
   * @param {String} filePath - The path to the File
   * @param {Boolean} preserveFiles - Whether to preserve the original file
   * @returns {Promise<void>} - The result promise
   */
  async addFile(filePath, preserveFiles) {
    await this.engineAddFiles(this.id, filePath, preserveFiles)
    this.numberOfRetrievedFiles += 1
    this.statusService.updateStatusDataStream({
      'Number of files since OIBus has started': this.numberOfRetrievedFiles,
      'Last added file at': new Date().toLocaleString(),
      'Last added file': filePath,
    })
  }

  /**
   * Read a given key in the config db of the South connector
   * @param {String} configKey - The key to retrieve
   * @returns {String} - The value of the key
   */
  getConfig(configKey) {
    return databaseService.getConfig(this.southDatabase, configKey)
  }

  /**
   * Update or add a given key in the config db of the South connector
   * @param {String} configKey -The key to update/add
   * @param {String} value - The value of the key
   * @returns {void}
   */
  setConfig(configKey, value) {
    databaseService.upsertConfig(this.southDatabase, configKey, value)
  }
}

module.exports = SouthConnector
