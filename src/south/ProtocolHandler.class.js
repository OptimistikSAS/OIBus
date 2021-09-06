const fs = require('fs')
const zlib = require('zlib')

const moment = require('moment-timezone')

const EncryptionService = require('../services/EncryptionService.class')
const databaseService = require('../services/database.service')
const Logger = require('../engine/Logger.class')

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
   * @param {Engine} engine - The engine
   * @param {object} supportedModes - The supported modes
   * @return {void}
   */
  constructor(dataSource, engine, supportedModes) {
    this.dataSource = dataSource
    this.engine = engine
    this.encryptionService = EncryptionService.getInstance()
    this.compressionLevel = 9
    const { engineConfig } = this.engine.configService.getConfig()
    this.engineConfig = engineConfig
    this.supportedModes = supportedModes

    const { logParameters } = this.dataSource
    this.logger = new Logger()
    this.logger.changeParameters(this.engineConfig, logParameters)

    if (this.supportedModes) {
      const { supportListen, supportLastPoint, supportFile, supportHistory } = this.supportedModes
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

      if (supportHistory) {
        this.lastCompletedAt = {}
        this.ongoingReads = {}
        if (this.dataSource.scanMode) {
          this.lastCompletedAt[this.dataSource.scanMode] = new Date().getTime()
          this.ongoingReads[this.dataSource.scanMode] = false
        } else if (this.dataSource[this.constructor.name].scanGroups) {
          // Group all points in their respective scanGroup
          // Each scanGroup is also initialized with a default "last completed date" equal to current Time
          this.scanGroups = this.dataSource[this.constructor.name].scanGroups.map((scanGroup) => {
            const points = this.dataSource.points
              .filter((point) => point.scanMode === scanGroup.scanMode)
              .map((point) => point.nodeId)
            this.lastCompletedAt[scanGroup.scanMode] = new Date().getTime()
            this.ongoingReads[scanGroup.scanMode] = false
            return {
              name: scanGroup.scanMode,
              ...scanGroup,
              points,
            }
          })
        } else {
          this.logger.error(`${this.dataSource.dataSourceId} scanGroups are not defined. This South driver will not work`)
          this.scanGroups = []
        }
      }
    }

    this.connected = false

    this.lastOnScanAt = null
    this.lastAddFileAt = null
    this.addFileCount = 0
    this.lastAddPointsAt = null
    this.addPointsCount = 0
    this.currentlyOnScan = false
    this.buffer = []
    this.bufferTimeout = null
  }

  async connect() {
    const { id, name, protocol, startTime } = this.dataSource

    const databasePath = `${this.engineConfig.caching.cacheFolder}/${dataSourceId}.db`
    this.southDatabase = await databaseService.createConfigDatabase(databasePath)

    if (this.supportedModes?.supportHistory) {
      // Initialize lastCompletedAt for every scanMode
      // "startTime" is currently a "hidden" parameter of oibus.json
      const defaultLastCompletedAt = startTime ? new Date(startTime) : new Date()

      // Disable ESLint check because we need for..of loop to support async calls
      // eslint-disable-next-line no-restricted-syntax
      for (const scanMode of Object.keys(this.lastCompletedAt)) {
        // Disable ESLint check because we want to get the values one by one to avoid parallel access to the SQLite database
        // eslint-disable-next-line no-await-in-loop
        const lastCompletedAt = await this.getConfig(`lastCompletedAt-${scanMode}`)
        this.lastCompletedAt[scanMode] = lastCompletedAt ? new Date(lastCompletedAt) : defaultLastCompletedAt
        this.logger.info(`Initializing lastCompletedAt for ${scanMode} with ${this.lastCompletedAt[scanMode]}`)
      }
    }

    this.logger.info(`Data source ${name} (${id}) started with protocol ${protocol}`)
  }

  async onScanImplementation(scanMode) {
    if (!this.connected || this.ongoingReads[scanMode]) {
      this.logger.silly(`onScan ignored: connected: ${this.connected},ongoingReads[${scanMode}]: ${this.ongoingReads[scanMode]}`)
      return
    }

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

    let startTime = this.lastCompletedAt[scanMode]
    const endTime = new Date()
    let intervalEndTime = endTime
    let firstIteration = true
    do {
      // Wait between the read interval iterations to give time for the Cache to store the data from the previous iteration
      if (!firstIteration) {
        this.logger.silly(`Wait ${this.readIntervalDelay} ms`)
        // eslint-disable-next-line no-await-in-loop
        await this.delay(this.readIntervalDelay)
      }

      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests (for example only one hour if maxReadInterval is 3600)
      if ((endTime.getTime() - startTime.getTime()) > 1000 * this.maxReadInterval) {
        intervalEndTime = new Date(startTime.getTime() + 1000 * this.maxReadInterval)
      } else {
        intervalEndTime = endTime
      }

      // eslint-disable-next-line no-await-in-loop
      await this.historyQuery(scanMode, startTime, intervalEndTime)

      startTime = intervalEndTime
      firstIteration = false
    } while (intervalEndTime !== endTime)
  }

  async onScan(scanMode) {
    if (this.currentlyOnScan) {
      this.logger.debug(`${this.constructor.name} already activated on scanMode: ${scanMode}. Skipping it.`)
    } else {
      this.currentlyOnScan = true
      this.logger.debug(`${this.constructor.name} activated on scanMode: ${scanMode}.`)
      this.lastOnScanAt = new Date().getTime()
      try {
        if (this.supportedModes?.supportLastPoint) {
          await this.lastPointQuery(scanMode)
        }
        if (this.supportedModes?.supportFile) {
          await this.fileQuery(scanMode)
        }
        if (this.supportedModes?.supportHistory) {
          await this.onScanImplementation(scanMode)
        }
      } catch (error) {
        this.logger.error(`${this.constructor.name} on scan error: ${error}.`)
      }
      this.currentlyOnScan = false
    }
  }

  disconnect() {
    const { name, id } = this.dataSource
    this.logger.info(`Data source ${name} (${id}) disconnected`)
  }

  /**
   * Method used to flush the buffer from a time trigger or a max trigger
   * @param {string} flag - The trigger
   * @returns {void}
   */
  async flush(flag = 'time-flush') {
    this.logger.silly(`${flag}: ${this.buffer.length}, ${this.dataSource.name}`)
    // save the buffer to be sent and immediately clear it
    const bufferSave = [...this.buffer]
    this.buffer = []
    await this.engine.addValues(this.dataSource.id, bufferSave)
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
    // used for status
    this.lastAddPointsAt = new Date().getTime()
    this.addPointsCount += values.length
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
    this.lastAddFileAt = new Date().getTime()
    this.addFileCount += 1
    this.engine.addFile(this.dataSource.id, filePath, preserveFiles)
  }

  /**
   * Compress the specified file
   * @param {string} input - The path of the file to compress
   * @param {string} output - The path to the compressed file
   * @returns {Promise} - The compression result
   */
  compress(input, output) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(input)
      const writeStream = fs.createWriteStream(output)
      const gzip = zlib.createGzip({ level: this.compressionLevel })
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
   * @returns {string} - The value of the key
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
   * Get live status.
   * @returns {object} - The live status
   */
  getStatus() {
    const status = {
      Name: this.dataSource.name,
      Id: this.dataSource.id,
      'Last scan time': this.lastOnScanAt ? new Date(this.lastOnScanAt).toLocaleString() : 'Never',
    }
    if (this.handlesFiles) {
      status['Last file added time'] = this.lastAddFileAt ? new Date(this.lastAddFileAt).toLocaleString() : 'Never'
      status['Number of files added'] = this.addFileCount
    }
    if (this.handlesPoints) {
      status['Last values added time'] = this.lastAddPointsAt ? new Date(this.lastAddPointsAt).toLocaleString() : 'Never'
      status['Number of values added'] = this.addPointsCount
    }
    if (this.canHandleHistory) {
      if (this.lastCompletedAt) {
        if (typeof this.lastCompletedAt === 'object') {
          Object.entries(this.lastCompletedAt).forEach(([key, value]) => {
            status[`Last completed at - ${key}`] = new Date(value).toLocaleString()
          })
        } else {
          status['Last completed at'] = new Date(this.lastCompletedAt).toLocaleString()
        }
      } else {
        status['Last completed at'] = 'Never'
      }
    }
    return status
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
   * Generate date based on the configured format taking into account the timezone configuration.
   * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
   * @param {string} date - The date to parse and format
   * @param {string} timezone - The timezone to use to replace the timezone of the date
   * @param {string} dateFormat - The format of the date
   * @returns {string} - The formatted date with timezone
   */
  static generateDateWithTimezone(date, timezone, dateFormat) {
    const timestampWithoutTZAsString = moment.utc(date, dateFormat).format('YYYY-MM-DD HH:mm:ss.SSS')
    return moment.tz(timestampWithoutTZAsString, timezone).toISOString()
  }
}

module.exports = ProtocolHandler
