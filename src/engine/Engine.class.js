const timexe = require('timexe')
const path = require('path')

const encryptionService = require('../services/encryption.service')
const VERSION = require('../../package.json').version

// South classes
const protocolList = {}
protocolList.Modbus = require('../south/Modbus/Modbus.class')
protocolList.OPCUA = require('../south/OPCUA/OPCUA.class')
protocolList.CSV = require('../south/CSV/CSV.class')
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
apiList.AliveSignal = require('../north/alivesignal/AliveSignal.class')
apiList.OIConnect = require('../north/oiconnect/OIConnect.class')

// Engine classes
const Server = require('../server/Server.class')
const Logger = require('./Logger.class')
const Cache = require('./Cache.class')
const ConfigService = require('../services/config.service.class')

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
   */
  constructor() {
    this.version = VERSION

    this.configService = new ConfigService(this)
    const { engineConfig, southConfig } = this.configService.getConfig()

    // Configure and get the logger
    this.logger = new Logger(engineConfig.logParameters)

    this.configService.setLogger(this.logger)

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
    encryptionService.checkOrCreatePrivateKey(this.configService.keyFolder, this.logger)

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
        } else if (dataSource.points) {
          dataSource.points.forEach((point) => {
            if (!this.scanLists[point.scanMode]) {
              this.logger.error(
                ` point: ${point.pointId} in dataSource: ${dataSource.dataSourceId} has a unknown scan mode: ${
                  point.scanMode
                }`,
              )
            } else if (!this.scanLists[point.scanMode].includes(dataSource.dataSourceId)) {
              // add the source for this scan only if not already there
              this.scanLists[point.scanMode].push(dataSource.dataSourceId)
            }
          })
        }
      }
    })

    // Will only contain protocols/application used
    // based on the config file
    this.activeProtocols = {}
    this.activeApis = {}
    this.jobs = []
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
   * @return {Promise} - The send promise
   */
  async handleValuesFromCache(applicationId, values) {
    this.logger.silly(`Engine handleValuesFromCache() call with ${applicationId} and ${values.length} values`)
    let success = false
    try {
      success = await this.activeApis[applicationId].handleValues(values)
    } catch (error) {
      this.logger.error(error)
    }
    return success
  }

  /**
   * Send file to a North application.
   * @param {string} applicationId - The application ID
   * @param {string} filePath - The file to send
   * @return {Promise} - The send promise
   */
  async sendFile(applicationId, filePath) {
    this.logger.silly(`Engine sendFile() call with ${applicationId} and ${filePath}`)
    let success = false

    try {
      success = await this.activeApis[applicationId].handleFile(filePath)
    } catch (error) {
      this.logger.error(error)
    }

    return success
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
            this.activeProtocols[dataSourceId].onScan(scanMode)
          })
        })
        if (job.result !== 'ok') {
          this.logger.error(`The scan  ${scanMode} could not start : ${job.error}`)
        } else {
          this.jobs.push(job.id)
        }
      }
    })
    this.logger.info('OIBus started')
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {void}
   */
  stop() {
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
  }

  /**
   * Restart Engine.
   * @param {number} timeout - The delay to wait before restart
   * @returns {void}
   */
  reload(timeout) {
    this.stop()

    setTimeout(() => {
      process.exit(1)
    }, timeout)
  }

  /**
   * Decrypt password.
   * @param {string} password - The password to decrypt
   * @return {string} - The decrypted password
   */
  decryptPassword(password) {
    return encryptionService.decryptText(password, this.configService.keyFolder, this.logger)
  }

  /**
   * Return available North applications
   * @return {String[]} - Available North applications
   */
  getNorthSchemaList() {
    this.logger.debug('Getting North applications')
    return Object.keys(apiList)
  }

  /**
   * Return available South protocols
   * @return {String[]} - Available South protocols
   */
  getSouthSchemaList() {
    this.logger.debug('Getting South protocols')
    return Object.keys(protocolList)
  }

  /**
   * Get schema definition for the given api
   * @param {String} api - The api to get the schema for
   * @return {Object} - The api schema
   */
  getNorthSchema(api) {
    if (Object.keys(apiList).includes(api)) {
      this.logger.debug(`Getting schema for North application ${api}`)

      return apiList[api].schema
    }

    return null
  }

  /**
   * Get schema definition for the given protocol
   * @param {String} protocol - The protocol to get the schema for
   * @return {Object} - The protocol schema
   */
  getSouthSchema(protocol) {
    if (Object.keys(protocolList).includes(protocol)) {
      this.logger.debug(`Getting schema for South protocol ${protocol}`)

      return protocolList[protocol].schema
    }

    return null
  }

  /**
    * Get OIBus version
    * @returns {string} - The OIBus version
    */
  getVersion() {
    return this.version
  }
}

module.exports = Engine
