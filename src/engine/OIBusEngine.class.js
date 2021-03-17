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
const HealthSignal = require('./HealthSignal.class')

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
   * @param {boolean} check - the engine will display the version and quit
   */
  constructor(configFile, check) {
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
    this.forwardedHealthSignalMessages = 0
    this.check = check

    // Buffer delay in ms: when a protocol generates a lot of values at the same time, it may be better to accumulate them
    // in a buffer before sending them to the engine
    // Max buffer: if the buffer reaches this length, it will be sent to the engine immediately
    // these parameters could be settings from OIBus UI
    this.bufferMax = engineConfig.caching.bufferMax
    this.bufferTimeoutInterval = engineConfig.caching.bufferTimeoutInterval
  }

  /**
   * Add a new Value from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} id - The data source id
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(id, values) {
    const sanitizedValues = values.filter((value) => value?.data?.value !== undefined && value?.data?.value !== null)
    this.logger.silly(`Engine: Add ${sanitizedValues?.length} values from "${this.activeProtocols[id]?.dataSource.name || id}"`)
    if (sanitizedValues.length) await this.cache.cacheValues(id, sanitizedValues)
  }

  /**
   * Add a new File from an data source to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} id - The data source id
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(id, filePath, preserveFiles) {
    this.logger.silly(`Engine addFile() from "${this.activeProtocols[id]?.dataSource.name || id}" with ${filePath}`)
    this.cache.cacheFile(id, filePath, preserveFiles)
  }

  /**
   * Send values to a North application.
   * @param {string} id - The application id
   * @param {object[]} values - The values to send
   * @return {number} - The send status
   */
  async handleValuesFromCache(id, values) {
    this.logger.silly(`handleValuesFromCache() call with "${this.activeApis[id]?.application.name || id}" and ${values.length} values`)

    let status
    try {
      status = await this.activeApis[id].handleValues(values)
    } catch (error) {
      status = error
    }

    return status
  }

  /**
   * Send file to a North application.
   * @param {string} id - The application id
   * @param {string} filePath - The file to send
   * @return {number} - The send status
   */
  async sendFile(id, filePath) {
    this.logger.silly(`Engine sendFile() call with "${this.activeApis[id]?.application.name || id}" and ${filePath}`)

    let status
    try {
      status = await this.activeApis[id].handleFile(filePath)
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

    // if OIBus is called with --checked, it will exit immediately
    // this check is typically done in the CI mode.
    if (this.check) {
      this.logger.info('check mode => OIBus is stopping')
      await this.shutdown(500)
      return
    }
    if (engineConfig.safeMode || safeMode) {
      this.logger.warn('Starting in safe mode!')
      return
    }
    // 2. start Protocol for each data sources
    southConfig.dataSources.forEach((dataSource) => {
      const { id, protocol, enabled, name } = dataSource
      if (enabled) {
        // Initiate the correct Protocol
        const south = ProtocolFactory.create(protocol, dataSource, this)
        if (south) {
          this.activeProtocols[id] = south
          this.activeProtocols[id].connect()
        } else {
          this.logger.error(`Protocol for ${name} is not found : ${protocol}`)
        }
      }
    })

    // 3. start Applications
    northConfig.applications.forEach((application) => {
      const { id, api, enabled, name } = application
      // select the right api handler
      if (enabled) {
        // Initiate the correct API
        const north = ApiFactory.create(api, application, this)
        if (north) {
          this.activeApis[id] = north
          this.activeApis[id].connect()
        } else {
          this.logger.error(`API for ${name} is not found : ${api}`)
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
            this.logger.error(`dataSource: ${dataSource.name} has a unknown scan mode: ${dataSource.scanMode}`)
          } else if (!this.scanLists[dataSource.scanMode].includes(dataSource.id)) {
            // add the source for this scan only if not already there
            this.scanLists[dataSource.scanMode].push(dataSource.id)
          }
        } else if (Array.isArray(dataSource.points) && dataSource.points.length > 0) {
          dataSource.points.forEach((point) => {
            if (point.scanMode !== 'listen') {
              if (!this.scanLists[point.scanMode]) {
                this.logger.error(`point: ${point.pointId} in dataSource: ${dataSource.name} has a unknown scan mode: ${point.scanMode}`)
              } else if (!this.scanLists[point.scanMode].includes(dataSource.id)) {
                // add the source for this scan only if not already there
                this.scanLists[point.scanMode].push(dataSource.id)
              }
            }
          })
        } else {
          this.logger.error(` dataSource: ${dataSource.name} has no scan mode defined`)
        }
      }
    })
    this.logger.debug(JSON.stringify(this.scanLists, null, ' '))

    // 6. Start the timers for each scan modes
    engineConfig.scanModes.forEach(({ scanMode, cronTime }) => {
      if (scanMode !== 'listen') {
        const job = timexe(cronTime, () => {
          // on each scan, activate each protocols
          this.scanLists[scanMode].forEach((id) => {
            try {
              this.activeProtocols[id].onScan(scanMode)
            } catch (error) {
              this.logger.error(`scan for "${this.activeProtocols[id]?.dataSource.name || id}" failed: ${error}`)
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

    // 7. Start HealthSignal
    this.healthSignal = new HealthSignal(this)
    this.healthSignal.start()

    this.logger.info('OIBus started')
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    const { engineConfig } = this.configService.getConfig()

    if (engineConfig.safeMode || this.check) {
      return
    }

    // Stop HealthSignal
    this.healthSignal.stop()

    // Stop timers
    this.jobs.forEach((id) => {
      timexe.remove(id)
    })

    // Stop Protocols
    Object.entries(this.activeProtocols).forEach(([id, protocol]) => {
      this.logger.info(`Stopping south ${id}`)
      protocol.disconnect()
    })

    // Stop Applications
    Object.entries(this.activeApis).forEach(([id, application]) => {
      this.logger.info(`Stopping north ${id}`)
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
      this.logger.warn('Request process shutdown')
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
    const logsCount = await databaseService.getLogsCount(engineConfig.logParameters.sqliteLog.fileName)

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
      logError: logsCount.error,
      logWarning: logsCount.warn,
      filesErrorCount,
      valuesErrorCount,
      copyright: '(c) Copyright 2019-2021 Optimistik, all rights reserved.',
    }
  }

  /**
   * Get live status for a given South.
   * @param {string} id - The datasource id
   * @returns {object} - The live status
   */
  getStatusForSouth(id) {
    const south = this.activeProtocols[id]
    return south ? south.getStatus() : {}
  }
}

module.exports = OIBusEngine
