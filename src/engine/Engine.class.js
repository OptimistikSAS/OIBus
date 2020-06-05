const timexe = require('timexe')
const path = require('path')
const os = require('os')

const moment = require('moment-timezone')
const checkDiskSpace = require('check-disk-space')

const encryptionService = require('../services/encryption.service')
const requestService = require('../services/request.service')
const VERSION = require('../../package.json').version
const databaseService = require('../services/database.service')

// South classes
const protocolList = {}
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCUA = require('../south/OPCUA/OPCUA.class')
protocolList.MQTT = require('../south/MQTT/MQTT.class')
protocolList.SQLDbToFile = require('../south/SQLDbToFile/SQLDbToFile.class')
protocolList.FolderScanner = require('../south/FolderScanner/FolderScanner.class')
protocolList.OPCHDA = require('../south/OPCHDA/OPCHDA.class')

// North classes
const apiList = {}
apiList.Console = require('../north/console/Console.class')
apiList.InfluxDB = require('../north/influxdb/InfluxDB.class')
apiList.TimescaleDB = require('../north/timescaledb/TimescaleDB.class')
apiList.OIAnalyticsFile = require('../north/oianalyticsfile/OIAnalyticsFile.class')
apiList.AmazonS3 = require('../north/amazon/AmazonS3.class')
apiList.OIConnect = require('../north/oiconnect/OIConnect.class')
apiList.MongoDB = require('../north/mongodb/MongoDB.class')
apiList.MQTTNorth = require('../north/mqttnorth/MQTTNorth.class')

// Engine classes
const Server = require('../server/Server.class')
const Cache = require('./Cache.class')
const ConfigService = require('../services/config.service.class')
const Logger = require('./Logger.class')
const AliveSignal = require('./AliveSignal.class')

/**
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class Engine
 */
class Engine {
  /**
   * Constructor for Engine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and data sources.
   * @constructor
   * @param {string} configFile - The config file
   */
  constructor(configFile) {
    this.version = VERSION

    this.configService = new ConfigService(this, configFile)
    const { engineConfig, southConfig } = this.configService.getConfig()

    // Configure the logger
    this.logger = new Logger(this.constructor.name)
    this.logger.changeParameters(engineConfig.logParameters)

    // Configure the Cache
    this.cache = new Cache(this)
    this.logger.info(`
    Starting Engine ${this.version}
    architecture: ${process.arch}
    This platform is ${process.platform}
    Current directory: ${process.cwd()}
    Version Node: ${process.version}
    Config file: ${this.configService.configFile}
    Cache folder: ${path.resolve(engineConfig.caching.cacheFolder)}`)
    // Check for private key
    encryptionService.checkOrCreatePrivateKey(this.configService.keyFolder)

    // prepare config
    // Associate the scanMode to all corresponding data sources
    // so the engine will know which datasource to activate when a
    // scanMode has a tick.

    // initialize the scanLists with empty arrays
    this.scanLists = {}
    engineConfig.scanModes.forEach(({ scanMode }) => {
      this.scanLists[scanMode] = []
    })

    // browse config file for the various dataSource and points and build the object scanLists
    // with the list of dataSource to activate for each ScanMode.
    southConfig.dataSources.forEach((dataSource) => {
      if (dataSource.enabled) {
        if (dataSource.scanMode) {
          if (!this.scanLists[dataSource.scanMode]) {
            this.logger.error(` dataSource: ${dataSource.dataSourceId} has a unknown scan mode: ${dataSource.scanMode}`)
          } else if (!this.scanLists[dataSource.scanMode].includes(dataSource.dataSourceId)) {
            // add the source for this scan only if not already there
            this.scanLists[dataSource.scanMode].push(dataSource.dataSourceId)
          }
        } else if (Array.isArray(dataSource.points) && dataSource.points.length > 0) {
          dataSource.points.forEach((point) => {
            if (!this.scanLists[point.scanMode]) {
              this.logger.error(`point: ${point.pointId} in dataSource: ${dataSource.dataSourceId} has a unknown scan mode: ${point.scanMode}`)
            } else if (!this.scanLists[point.scanMode].includes(dataSource.dataSourceId)) {
              // add the source for this scan only if not already there
              this.scanLists[point.scanMode].push(dataSource.dataSourceId)
            }
          })
        } else {
          this.logger.error(` dataSource: ${dataSource.dataSourceId} has no scan mode defined`)
        }
      }
    })
    this.logger.debug(JSON.stringify(this.scanLists, null, ' '))
    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}
    this.jobs = []

    this.memoryStats = {}
    this.addValuesMessages = 0
    this.addValuesCount = 0
    this.aliveSignalMessages = 0

    // AliveSignal
    this.aliveSignal = new AliveSignal(this)
  }

  /**
   * Add a new Value from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(dataSourceId, values) {
    this.logger.silly(`Engine: Add ${values ? values.length : '?'} values from ${dataSourceId}`)
    await this.cache.cacheValues(dataSourceId, values)
  }

  /**
   * Add a new File from an data source to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} dataSourceId - The South generating the file
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(dataSourceId, filePath, preserveFiles) {
    this.logger.silly(`Engine addFile() from ${dataSourceId} with ${filePath}`)
    this.cache.cacheFile(dataSourceId, filePath, preserveFiles)
  }

  /**
   * Send values to a North application.
   * @param {string} applicationId - The application ID
   * @param {object[]} values - The values to send
   * @return {number} - The send status
   */
  async handleValuesFromCache(applicationId, values) {
    this.logger.silly(`Engine handleValuesFromCache() call with ${applicationId} and ${values.length} values`)

    let status
    try {
      status = await this.activeApis[applicationId].handleValues(values)
    } catch (error) {
      status = error
    }

    return status
  }

  /**
   * Send file to a North application.
   * @param {string} applicationId - The application ID
   * @param {string} filePath - The file to send
   * @return {number} - The send status
   */
  async sendFile(applicationId, filePath) {
    this.logger.silly(`Engine sendFile() call with ${applicationId} and ${filePath}`)

    let status
    try {
      status = await this.activeApis[applicationId].handleFile(filePath)
    } catch (error) {
      status = error
    }

    return status
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   * @return {void}
   */
  start() {
    const { southConfig, northConfig, engineConfig } = this.configService.getConfig()
    // 1. start web server
    const server = new Server(this)
    server.listen()

    // 2. start Protocol for each data sources
    southConfig.dataSources.forEach((dataSource) => {
      const { protocol, enabled, dataSourceId } = dataSource
      // select the correct Handler
      const ProtocolHandler = protocolList[protocol]
      if (enabled) {
        if (ProtocolHandler) {
          this.activeProtocols[dataSourceId] = new ProtocolHandler(dataSource, this)
          this.activeProtocols[dataSourceId].connect()
        } else {
          this.logger.error(`Protocol for ${dataSourceId} is not found : ${protocol}`)
        }
      }
    })

    // 3. start Applications
    this.pointApplication = {}
    northConfig.applications.forEach((application) => {
      const { api, enabled, applicationId } = application
      // select the right api handler
      const ApiHandler = apiList[api]
      if (enabled) {
        if (ApiHandler) {
          this.activeApis[applicationId] = new ApiHandler(application, this)
          this.activeApis[applicationId].connect()
        } else {
          this.logger.error(`API for ${applicationId} is not found : ${api}`)
        }
      }
    })

    // 4. Initiate the cache
    this.cache.initialize(this.activeApis)

    // 5. start the timers for each scan modes
    engineConfig.scanModes.forEach(({ scanMode, cronTime }) => {
      if (scanMode !== 'listen') {
        const job = timexe(cronTime, () => {
          // on each scan, activate each protocols
          this.scanLists[scanMode].forEach((dataSourceId) => {
            try {
              this.activeProtocols[dataSourceId].onScan(scanMode)
            } catch (error) {
              this.logger.error(`scan for ${dataSourceId} failed: ${error}`)
            }
          })
        })
        if (job.result !== 'ok') {
          this.logger.error(`The scan  ${scanMode} could not start : ${job.error}`)
        } else {
          this.jobs.push(job.id)
        }
      }
    })

    // 6. Start AliveSignal
    this.aliveSignal.start()

    this.logger.info('OIBus started')
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {void}
   */
  async stop() {
    // Stop AliveSignal
    this.aliveSignal.stop()

    // Stop timers
    this.jobs.forEach((id) => {
      timexe.remove(id)
    })

    // Stop Protocols
    Object.entries(this.activeProtocols).forEach(([dataSourceId, protocol]) => {
      this.logger.info(`Stopping ${dataSourceId}`)
      protocol.disconnect()
    })

    // Stop Applications
    Object.entries(this.activeApis).forEach(([applicationId, application]) => {
      this.logger.info(`Stopping ${applicationId}`)
      application.disconnect()
    })

    // Log cache data
    const apisCacheStats = await this.cache.getCacheStatsForApis()
    this.logger.info(`API stats: ${JSON.stringify(apisCacheStats)}`)

    const protocolsCacheStats = await this.cache.getCacheStatsForProtocols()
    this.logger.info(`Protocol stats: ${JSON.stringify(protocolsCacheStats)}`)
  }

  /**
   * Restart Engine.
   * @param {number} timeout - The delay to wait before restart
   * @returns {void}
   */
  async reload(timeout) {
    await this.stop()

    setTimeout(() => {
      process.exit(1)
    }, timeout)
  }

  /**
   * Decrypt password.
   * @param {string} password - The password to decrypt
   * @return {string|null} - The decrypted password
   */
  decryptPassword(password) {
    return encryptionService.decryptText(password, this.configService.keyFolder)
  }

  /**
   * Return available North applications
   * @return {String[]} - Available North applications
   */
  /* eslint-disable-next-line class-methods-use-this */
  getNorthList() {
    this.logger.debug('Getting North applications')
    return Object.keys(apiList)
  }

  /**
   * Return available South protocols
   * @return {String[]} - Available South protocols
   */
  /* eslint-disable-next-line class-methods-use-this */
  getSouthList() {
    this.logger.debug('Getting South protocols')
    return Object.keys(protocolList)
  }

  /**
    * Get OIBus version
    * @returns {string} - The OIBus version
    */
  getVersion() {
    return this.version
  }

  /**
   * Get active Protocols.
   * @returns {string[]} - The active Protocols
   */
  getActiveProtocols() {
    return Object.keys(this.activeProtocols)
  }

  /**
   * Get memory usage information.
   * @returns {object} - The memory usage information
   */
  getMemoryUsage() {
    const memoryUsage = process.memoryUsage()
    // ask the Master Cluster to also log memory usage
    process.send({ type: 'logMemoryUsage', memoryUsage })
    Object.entries(memoryUsage).forEach(([key, value]) => {
      if (!Object.keys(this.memoryStats).includes(key)) {
        this.memoryStats[key] = {
          min: value,
          current: value,
          max: value,
        }
      } else {
        this.memoryStats[key].min = (value < this.memoryStats[key].min) ? value : this.memoryStats[key].min
        this.memoryStats[key].current = value
        this.memoryStats[key].max = (value > this.memoryStats[key].max) ? value : this.memoryStats[key].max
      }
    })

    return Object.keys(this.memoryStats).reduce((result, key) => {
      const min = Number(this.memoryStats[key].min / 1024 / 1024).toFixed(2)
      const current = Number(this.memoryStats[key].current / 1024 / 1024).toFixed(2)
      const max = Number(this.memoryStats[key].max / 1024 / 1024).toFixed(2)
      result[key] = `${min}/${current}/${max} MB`
      return result
    }, {})
  }

  /**
   * Get status information.
   * @returns {object} - The status information
   */
  async getStatus() {
    const apisCacheStats = await this.cache.getCacheStatsForApis()
    const protocolsCacheStats = await this.cache.getCacheStatsForProtocols()
    const memoryUsage = this.getMemoryUsage()

    const freeMemory = Number(os.freemem() / 1024 / 1024).toFixed(2)
    const totalMemory = Number(os.totalmem() / 1024 / 1024).toFixed(2)
    const percentMemory = Number((freeMemory / totalMemory) * 100).toFixed(2)

    const { engineConfig } = this.configService.getConfig()
    const diskSpace = await checkDiskSpace(path.resolve(engineConfig.caching.cacheFolder))
    const freeSpace = Number(diskSpace.free / 1024 / 1024 / 1024).toFixed(2)
    const totalSpace = Number(diskSpace.size / 1024 / 1024 / 1024).toFixed(2)

    const databasePath = engineConfig.logParameters.sqliteFilename
    const logsCount = await databaseService.getLogsCount(databasePath)
    const errorLogCount = logsCount.find((logCount) => logCount.level === 'error')
    const warningLogCount = logsCount.find((logCount) => logCount.level === 'warn')

    const processUptime = 1000 * 1000 * process.uptime()
    const processCpuUsage = process.cpuUsage()
    const cpuUsagePercentage = Number((100 * (processCpuUsage.user + processCpuUsage.system)) / processUptime).toFixed(2)

    const filesErrorCount = await databaseService.getErroredFilesCount(this.cache.filesErrorDatabasePath)
    const valuesErrorCount = await databaseService.getErroredValuesCount(this.cache.valuesErrorDatabasePath)

    return {
      version: this.getVersion(),
      architecture: process.arch,
      currentDirectory: process.cwd(),
      nodeVersion: process.version,
      executable: process.execPath,
      configurationFile: this.configService.getConfigurationFileLocation(),
      memory: `${freeMemory}/${totalMemory}/${percentMemory} MB/%`,
      ...memoryUsage,
      disk: `${freeSpace}/${totalSpace} GB`,
      cpuUsage: `${cpuUsagePercentage}%`,
      processId: process.pid,
      uptime: moment.duration(process.uptime(), 'seconds').humanize(),
      hostname: os.hostname(),
      osRelease: os.release(),
      osType: os.type(),
      apisCacheStats,
      protocolsCacheStats,
      addValuesMessages: this.addValuesMessages,
      addValuesCount: this.addValuesCount,
      aliveSignalMessages: this.aliveSignalMessages,
      logError: errorLogCount ? errorLogCount.count : 0,
      logWarning: warningLogCount ? warningLogCount.count : 0,
      filesErrorCount,
      valuesErrorCount,
      copyright: '(c) Copyright 2019-2020 Optimistik, all rights reserved.',
    }
  }

  /**
   * Send HTTP request.
   * @param {string} requestUrl - The URL to send the request to
   * @param {string} method - The request type
   * @param {object} authentication - Authentication info
   * @param {object} proxy - Proxy to use
   * @param {string} data - The body to send
   * @param {object} baseHeaders - Headers to send
   * @returns {Promise} - The send status
   */
  async sendRequest(requestUrl, method, authentication, proxy, data, baseHeaders = {}) {
    return requestService.sendRequest(this, requestUrl, method, authentication, proxy, data, baseHeaders)
  }
}

module.exports = Engine
