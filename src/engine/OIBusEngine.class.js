const timexe = require('timexe')
const path = require('path')
const os = require('os')
const EventEmitter = require('events')
const humanizeDuration = require('humanize-duration')

// Engine classes
const BaseEngine = require('./BaseEngine.class')
const HealthSignal = require('./HealthSignal.class')
const MainCache = require('./cache/MainCache.class')
const Queue = require('../services/queue.class')

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
   * @param {ConfigService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   */
  constructor(configService, encryptionService) {
    super(configService, encryptionService)

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

    // manage a queue for concurrent request to write to SQL
    this.queue = new Queue(this.logger)
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {object} engineConfig - the config retrieved from the file
   * @param {string} loggerScope - the scope used for the logger
   * @returns {Promise<void>} - The promise returns when the services are set
   */
  async initEngineServices(engineConfig, loggerScope = 'OIBusEngine') {
    await super.initEngineServices(engineConfig, loggerScope)

    // Buffer delay in ms: when a protocol generates a lot of values at the same time, it may be better to accumulate them
    // in a buffer before sending them to the engine
    // Max buffer: if the buffer reaches this length, it will be sent to the engine immediately
    // these parameters could be settings from OIBus UI
    this.bufferMax = engineConfig.caching.bufferMax
    this.bufferTimeoutInterval = engineConfig.caching.bufferTimeoutInterval

    this.engineName = engineConfig.engineName

    this.logger.info(`Starting Engine ${this.version}
    architecture: ${process.arch}
    This platform is ${process.platform}
    Current directory: ${process.cwd()}
    Version Node: ${process.version}
    Config file: ${this.configService.configFile}
    HistoryQuery config file: ${this.configService.historyQueryConfigFile},
    Cache folder: ${path.resolve(engineConfig.caching.cacheFolder)}`)
  }

  /**
   * Add a new Value from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} id - The data source id
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(id, values) {
    this.logger.trace(`Engine: Add ${values?.length} values from "${this.activeProtocols[id]?.dataSource.name || id}"`)
    Object.values(this.activeApis)
      .forEach((api) => {
        if (api.canHandleValues && api.isSubscribed(id)) {
          api.cacheValues(id, values)
        }
      })
  }

  /**
   * Add a new File from an data source to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} id - The data source id
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  async addFile(id, filePath, preserveFiles) {
    this.logger.debug(`Engine addFile(${filePath}) from "${this.activeProtocols[id]?.dataSource.name || id}", preserveFiles:${preserveFiles}`)

    const timestamp = new Date().getTime()
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath)
    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`
    const cachePath = path.join(this.getCacheFolder(), cacheFilename)

    try {
      // Move or copy the file into the cache folder
      await MainCache.transferFile(this.logger, filePath, cachePath, preserveFiles)

      Object.values(this.activeApis)
        .forEach((api) => {
          if (api.canHandleFiles && api.isSubscribed(id)) {
            api.cacheFile(cachePath, timestamp)
          }
        })
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   *
   * @param {boolean} safeMode - Whether to start in safe mode
   * @return {void}
   */
  async start(safeMode = false) {
    const {
      southConfig,
      northConfig,
      engineConfig,
    } = this.configService.getConfig()
    await this.initEngineServices(engineConfig)
    this.initializeStatusData()

    this.safeMode = safeMode || engineConfig.safeMode
    if (this.safeMode) {
      this.logger.warn('OIBus Engine is running in safe mode')
      return
    }

    // 2. start Protocol for each data sources
    // eslint-disable-next-line no-restricted-syntax
    for (const dataSource of southConfig.dataSources) {
      const {
        id,
        protocol,
        enabled,
        name,
      } = dataSource
      if (enabled) {
        try {
          // Initiate the correct Protocol
          const south = this.createSouth(protocol, dataSource)
          if (south) {
            this.activeProtocols[id] = south
            // eslint-disable-next-line no-await-in-loop
            await this.activeProtocols[id].init()
            this.activeProtocols[id].connect()
          } else {
            this.logger.error(`Protocol for ${name} is not found: ${protocol}`)
          }
        } catch (error) {
          this.logger.error(`Error when starting south connector ${name}: ${error}`)
        }
      }
    }

    // 3. start Applications
    // eslint-disable-next-line no-restricted-syntax
    for (const application of northConfig.applications) {
      const {
        id,
        api,
        enabled,
        name,
      } = application
      // select the right api handler
      if (enabled) {
        try {
        // Initiate the correct API
          const north = this.createNorth(api, application)
          if (north) {
            this.activeApis[id] = north
            // eslint-disable-next-line no-await-in-loop
            await this.activeApis[id].init()
            this.activeApis[id].connect()
          } else {
            this.logger.error(`API for ${name} is not found: ${api}`)
          }
        } catch (error) {
          this.logger.error(`Error when starting north connector ${name}: ${error}`)
        }
      }
    }

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
    engineConfig.scanModes.forEach(({
      scanMode,
      cronTime,
    }) => {
      if (scanMode !== 'listen') {
        const job = timexe(cronTime, () => {
          // on each scan, activate each protocol
          this.scanLists[scanMode].forEach(async (id) => {
            await this.activeProtocols[id].onScan(scanMode)
          })
        })
        if (job.result !== 'ok') {
          this.logger.error(`The scan ${scanMode} could not start : ${job.error}`)
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
    if (this.liveStatusInterval) {
      clearInterval(this.liveStatusInterval)
    }

    if (this.safeMode) {
      return
    }

    // Stop HealthSignal
    if (this.healthSignal) {
      this.healthSignal.stop()
    }

    // Stop timers
    this.jobs.forEach((id) => {
      timexe.remove(id)
    })
    this.jobs = []

    // Stop Protocols
    // eslint-disable-next-line no-restricted-syntax
    for (const protocol of Object.values(this.activeProtocols)) {
      this.logger.info(`Stopping south ${protocol.dataSource.name} (${protocol.dataSource.id})`)
      // eslint-disable-next-line no-await-in-loop
      await protocol.disconnect()
    }
    this.activeProtocols = {}

    // Log cache data
    const apisCacheStats = this.getCacheStatsForApis()
    this.logger.info(`API stats: ${JSON.stringify(apisCacheStats)}`)

    const protocolsCacheStats = this.getCacheStatsForProtocols()
    this.logger.info(`Protocol stats: ${JSON.stringify(protocolsCacheStats)}`)

    // Stop Applications
    // eslint-disable-next-line no-restricted-syntax
    for (const application of Object.values(this.activeApis)) {
      this.logger.info(`Stopping north ${application.application.name} (${application.application.id})`)
      // eslint-disable-next-line no-await-in-loop
      await application.disconnect()
    }
    this.activeApis = {}

    // Stop the listener
    this.eventEmitters['/engine/sse']?.events?.removeAllListeners()
    this.eventEmitters['/engine/sse']?.stream?.destroy()
  }

  /**
   * Return available North applications
   * @return {String[]} - Available North applications
   */
  /* eslint-disable-next-line class-methods-use-this */
  getNorthList() {
    this.logger.debug('Getting North applications')
    return Object.entries(this.getNorthEngineList())
      .map(([connectorName, { category }]) => ({
        connectorName,
        category,
      }))
  }

  /**
   * Return available South protocols
   * @return {String[]} - Available South protocols
   */

  /* eslint-disable-next-line class-methods-use-this */
  getSouthList() {
    this.logger.debug('Getting South protocols')
    return Object.entries(this.getSouthEngineList())
      .map(([connectorName, { category }]) => ({
        connectorName,
        category,
      }))
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
    Object.entries(memoryUsage)
      .forEach(([key, value]) => {
        if (!Object.keys(this.memoryStats)
          .includes(key)) {
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

    return Object.keys(this.memoryStats)
      .reduce((result, key) => {
        const min = Number(this.memoryStats[key].min / 1024 / 1024)
          .toFixed(2)
        const current = Number(this.memoryStats[key].current / 1024 / 1024)
          .toFixed(2)
        const max = Number(this.memoryStats[key].max / 1024 / 1024)
          .toFixed(2)
        result[key] = `${min} / ${current} / ${max} MB`
        return result
      }, {})
  }

  getCacheStatsForApis() {
    // Get points APIs stats
    const pointApis = Object.values(this.activeApis).filter((api) => api.canHandleValues)
    const pointApisStats = pointApis.map((api) => api.getValueCacheStats())

    // Get files APIs stats
    const fileApis = Object.values(this.activeApis).filter((api) => api.canHandleFiles)
    const fileApisStats = fileApis.map((api) => api.getFileCacheStats())

    // Merge results
    return [...pointApisStats, ...fileApisStats]
  }

  getCacheStatsForProtocols() {
    const pointProtocols = Object.values(this.activeProtocols).filter((protocol) => protocol.handlesPoints)
    return pointProtocols.map((protocol) => ({
      name: protocol.dataSource.name,
      count: protocol.addPointsCount || 0,
    }))
  }

  /**
   * Get status information.
   * @returns {object} - The status information
   */
  async getOIBusInfo() {
    return {
      version: this.getVersion(),
      architecture: process.arch,
      'Current directory': process.cwd(),
      'Node version': process.version,
      executable: process.execPath,
      'Configuration file': this.configService.getConfigurationFileLocation(),
      'History Query Database': this.configService.getHistoryQueryConfigurationFileLocation(),
      processId: process.pid,
      hostname: os.hostname(),
      osRelease: os.release(),
      osType: os.type(),
      copyright: '(c) Copyright 2019-2022 Optimistik, all rights reserved.',
    }
  }

  /**
   * Get cache folder
   * @return {string} - The cache folder
   */
  getCacheFolder() {
    const { engineConfig } = this.configService.getConfig()
    return engineConfig.caching.cacheFolder
  }

  /**
   * Update engine status data to be displayed on the home screen
   * @returns {void}
   */
  initializeStatusData() {
    if (!this.eventEmitters['/engine/sse']) {
      this.eventEmitters['/engine/sse'] = {}
    }
    this.eventEmitters['/engine/sse'].events = new EventEmitter()
    this.eventEmitters['/engine/sse'].events.on('data', this.listener)
    this.updateEngineStatusData()
    if (this.liveStatusInterval) {
      clearInterval(this.liveStatusInterval)
    }
    this.liveStatusInterval = setInterval(() => {
      this.updateEngineStatusData()
    }, 5000)
  }

  updateEngineStatusData() {
    const processCpuUsage = process.cpuUsage()
    const processUptime = 1000 * 1000 * process.uptime()
    const cpuUsagePercentage = Number((100 * (processCpuUsage.user + processCpuUsage.system)) / processUptime)
      .toFixed(2)
    const freeMemory = Number(os.freemem() / 1024 / 1024 / 1024)
      .toFixed(2)
    const totalMemory = Number(os.totalmem() / 1024 / 1024 / 1024)
      .toFixed(2)
    const percentMemory = Number((freeMemory / totalMemory) * 100)
      .toFixed(2)
    const memoryUsage = this.getMemoryUsage()

    const northConnectorsStatus = {}
    Object.values(this.activeApis).forEach((activeNorthConnector) => {
      if (activeNorthConnector.canHandleValues) {
        northConnectorsStatus[`Number of values sent to North "${
          activeNorthConnector.application.name}"`] = activeNorthConnector.statusData['Number of values sent since OIBus has started']
      }
      if (activeNorthConnector.canHandleFiles) {
        northConnectorsStatus[`Number of files sent to North "${
          activeNorthConnector.application.name}"`] = activeNorthConnector.statusData['Number of files sent since OIBus has started']
      }
    })

    const southConnectorsStatus = {}
    Object.values(this.activeProtocols).forEach((activeSouthConnector) => {
      if (activeSouthConnector.handlesPoints) {
        southConnectorsStatus[`Number of values retrieved from South "${
          activeSouthConnector.dataSource.name}"`] = activeSouthConnector.statusData['Number of values since OIBus has started']
      }
      if (activeSouthConnector.handlesFiles) {
        southConnectorsStatus[`Number of files retrieved from South "${
          activeSouthConnector.dataSource.name}"`] = activeSouthConnector.statusData['Number of files since OIBus has started']
      }
    })

    this.updateStatusDataStream({
      'Up time': humanizeDuration(1000 * process.uptime(), { round: true }),
      'CPU usage': `${cpuUsagePercentage}%`,
      'OS free memory': `${freeMemory} GB / ${totalMemory} GB (${percentMemory} %)`,
      'RAM occupation (min / current / max)': memoryUsage.rss,
      'Total heap size (min / current / max)': memoryUsage.heapTotal,
      'Heap used (min / current / max)': memoryUsage.heapUsed,
      'External C++ V8 memory (min / current / max)': memoryUsage.external,
      'Array buffers memory (min / current / max)': memoryUsage.arrayBuffers,
      ...northConnectorsStatus,
      ...southConnectorsStatus,
    })
  }

  updateStatusDataStream(statusData = {}) {
    this.statusData = { ...this.statusData, ...statusData }
    this.eventEmitters['/engine/sse'].statusData = this.statusData
    this.eventEmitters['/engine/sse']?.events?.emit('data', this.statusData)
  }

  /**
   * Method used by the eventEmitter of the current protocol to write data to the socket and send them to the frontend
   * @param {object} data - The json object of data to send
   * @return {void}
   */
  listener = (data) => {
    if (data) {
      this.eventEmitters['/engine/sse']?.stream?.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }
}

module.exports = OIBusEngine
