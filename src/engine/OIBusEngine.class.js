const timexe = require('timexe')
const path = require('path')
const os = require('os')

const moment = require('moment-timezone')

const databaseService = require('../services/database.service')

const ProtocolFactory = require('../south/ProtocolFactory.class')
const ApiFactory = require('../north/ApiFactory.class')

// Engine classes
const BaseEngine = require('./BaseEngine.class')
const Server = require('../server/Server.class')
const Cache = require('./Cache.class')
const AliveSignal = require('./AliveSignal.class')

/**
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class OIBusEngine
 */
class OIBusEngine extends BaseEngine {
  /**
   * Constructor for OIBusEngine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and data sources.
   * @constructor
   * @param {string} configFile - The config file
   */
  constructor(configFile) {
    super(configFile)

    // Configure the Cache
    this.cache = new Cache(this)
    this.cache.initialize()

    const { engineConfig } = this.configService.getConfig()
    this.logger.info(`
    Starting Engine ${this.version}
    architecture: ${process.arch}
    This platform is ${process.platform}
    Current directory: ${process.cwd()}
    Version Node: ${process.version}
    Config file: ${this.configService.configFile}
    Cache folder: ${path.resolve(engineConfig.caching.cacheFolder)}`)

    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}
    this.jobs = []

    this.memoryStats = {}
    this.addValuesMessages = 0
    this.addValuesCount = 0
    this.addFileCount = 0
    this.forwardedAliveSignalMessages = 0
  }

  /**
   * Add a new Value from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(dataSourceId, values) {
    const sanitizedValues = values.filter((value) => value?.data?.value !== undefined && value?.data?.value !== null)
    this.logger.silly(`Engine: Add ${sanitizedValues?.length} values from ${dataSourceId}`)
    if (sanitizedValues.length) await this.cache.cacheValues(dataSourceId, sanitizedValues)
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
    this.logger.silly(`handleValuesFromCache() call with ${applicationId} and ${values.length} values`)

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
   *
   * @param {boolean} safeMode - Whether to start in safe mode
   * @return {void}
   */
  async start(safeMode = false) {
    const { southConfig, northConfig, engineConfig } = this.configService.getConfig()
    // 1. start web server
    const server = new Server(this)
    server.listen()

    if (engineConfig.safeMode || safeMode) {
      this.logger.warn('Starting in safe mode!')
      return
    }

    // 2. start Protocol for each data sources
    southConfig.dataSources.forEach((dataSource) => {
      const { protocol, enabled, dataSourceId } = dataSource
      if (enabled) {
        // Initiate the correct Protocol
        const south = ProtocolFactory.create(protocol, dataSource, this)
        if (south) {
          this.activeProtocols[dataSourceId] = south
          this.activeProtocols[dataSourceId].connect()
        } else {
          this.logger.error(`Protocol for ${dataSourceId} is not found : ${protocol}`)
        }
      }
    })

    // 3. start Applications
    northConfig.applications.forEach((application) => {
      const { api, enabled, applicationId } = application
      // select the right api handler
      if (enabled) {
        // Initiate the correct API
        const north = ApiFactory.create(api, application, this)
        if (north) {
          this.activeApis[applicationId] = north
          this.activeApis[applicationId].connect()
        } else {
          this.logger.error(`API for ${applicationId} is not found : ${api}`)
        }
      }
    })

    // 4. Initiate the cache for every North
    await this.cache.initializeApis(this.activeApis)

    // 5. Initialize scan lists

    // Associate the scanMode to all corresponding data sources
    // so the engine will know which datasource to activate when a
    // scanMode has a tick.

    // Initialize the scanLists with empty arrays
    this.scanLists = {}
    engineConfig.scanModes.forEach(({ scanMode }) => {
      this.scanLists[scanMode] = []
    })

    // Browse config file for the various dataSource and points and build the object scanLists
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
            if (point.scanMode !== 'listen') {
              if (!this.scanLists[point.scanMode]) {
                this.logger.error(`point: ${point.pointId} in dataSource: ${dataSource.dataSourceId} has a unknown scan mode: ${point.scanMode}`)
              } else if (!this.scanLists[point.scanMode].includes(dataSource.dataSourceId)) {
                // add the source for this scan only if not already there
                this.scanLists[point.scanMode].push(dataSource.dataSourceId)
              }
            }
          })
        } else {
          this.logger.error(` dataSource: ${dataSource.dataSourceId} has no scan mode defined`)
        }
      }
    })
    this.logger.debug(JSON.stringify(this.scanLists, null, ' '))

    // 6. Start the timers for each scan modes
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

    // 7. Start AliveSignal
    this.aliveSignal = new AliveSignal(this)
    this.aliveSignal.start()

    this.logger.info('OIBus started')
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    const { engineConfig } = this.configService.getConfig()

    if (engineConfig.safeMode) {
      return
    }

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
    this.logger.warn('Reloading OIBus')

    setTimeout(() => {
      // Ask the Master Cluster to reload
      process.send({ type: 'reload' })
    }, timeout)
  }

  /**
   * Shutdown OIbus.
   * @param {number} timeout - The delay to wait before restart
   * @returns {void}
   */
  async shutdown(timeout) {
    this.logger.warn('Shutting down OIBus')

    setTimeout(() => {
      // Ask the Master Cluster to shutdown
      process.send({ type: 'shutdown' })
    }, timeout)
  }

  /**
   * Return available North applications
   * @return {String[]} - Available North applications
   */
  /* eslint-disable-next-line class-methods-use-this */
  getNorthList() {
    this.logger.debug('Getting North applications')
    return ApiFactory.getNorthList()
  }

  /**
   * Return available South protocols
   * @return {String[]} - Available South protocols
   */
  /* eslint-disable-next-line class-methods-use-this */
  getSouthList() {
    this.logger.debug('Getting South protocols')
    return ProtocolFactory.getSouthList()
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
    const logsCount = await databaseService.getLogsCount(engineConfig.logParameters.sqliteFilename)

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
      addFileCount: this.addFileCount,
      forwardedAliveSignalMessages: this.forwardedAliveSignalMessages,
      logError: logsCount.error,
      logWarning: logsCount.warn,
      filesErrorCount,
      valuesErrorCount,
      copyright: '(c) Copyright 2019-2021 Optimistik, all rights reserved.',
    }
  }
}

module.exports = OIBusEngine
