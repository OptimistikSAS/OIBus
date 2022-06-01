const EventEmitter = require('events')

const EncryptionService = require('../services/EncryptionService.class')
const Logger = require('../engine/logger/Logger.class')
const CertificateService = require('../services/CertificateService.class')
const ValueCache = require('../engine/cache/ValueCache.class')
const FileCache = require('../engine/cache/FileCache.class')

class ApiHandler {
  static STATUS = {
    SUCCESS: 0,
    LOGIC_ERROR: -1,
    COMMUNICATION_ERROR: -2,
  }

  /**
   * Constructor for Application
   * Building a new North API means to extend this class, and to surcharge
   * the following methods:
   * - **handleValues**: receive an array of values that need to be sent to an external applications
   * - **handleFile**: receive a file that need to be sent to an external application.
   * - **connect**: to allow establishing proper connection to the external application (optional)
   * - **disconnect**: to allow proper disconnection (optional)
   *
   * The constructor of the API need to initialize:
   * - **this.canHandleValues** to true in order to receive values with handleValues()
   * - **this.canHandleFiles** to true in order to receive a file with handleFile()
   *
   * In addition, it is possible to use a number of helper functions:
   * - **getProxy**: get the proxy handler
   * - **logger**: to log an event with different levels (error,warning,info,debug)
   *
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    this.canHandleValues = false
    this.canHandleFiles = false

    this.application = applicationParameters
    this.engine = engine
    this.encryptionService = EncryptionService.getInstance()
    const { engineConfig } = this.engine.configService.getConfig()
    this.engineConfig = engineConfig
    this.connected = false

    this.scanModes = this.engine.scanModes
    this.statusData = {}

    this.keyFile = null
    this.certFile = null
    this.caFile = null
    this.valueCache = null
    this.fileCache = null
  }

  async init() {
    const { logParameters } = this.application
    this.logger = new Logger(`North:${this.application.name}`)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(this.engineConfig, logParameters)

    this.certificate = new CertificateService(this.logger)
    await this.certificate.init(this.keyFile, this.certFile, this.caFile)
    this.initializeStatusData()

    const { engineConfig } = this.engine.configService.getConfig()
    this.valueCache = new ValueCache(this, this.engine.queue, engineConfig.caching)
    await this.valueCache.initialize()
    this.fileCache = await FileCache.getFileCacheInstance(this, engineConfig.caching)
  }

  /**
   * Method called by Engine to initialize a given api. This method can be surcharged in the
   * North api implementation to allow connection to a third party application for example.
   * @param {string} additionalInfo - connection information to display in the logger
   * @return {void}
   */
  async connect(additionalInfo) {
    const { name, api } = this.application
    this.connected = true
    this.updateStatusDataStream({ 'Connected at': new Date().toISOString() })
    if (additionalInfo) {
      this.logger.info(`North API ${name} started with protocol ${api} ${additionalInfo}`)
    } else {
      this.logger.info(`North API ${name} started with protocol ${api}`)
    }
  }

  initializeStatusData() {
    if (!this.engine.eventEmitters[`/north/${this.application.id}/sse`]) {
      this.engine.eventEmitters[`/north/${this.application.id}/sse`] = {}
    } else {
      this.engine.eventEmitters[`/north/${this.application.id}/sse`].events.removeAllListeners()
      this.engine.eventEmitters[`/north/${this.application.id}/sse`].stream?.destroy()
    }
    this.engine.eventEmitters[`/north/${this.application.id}/sse`].events = new EventEmitter()
    this.engine.eventEmitters[`/north/${this.application.id}/sse`].events.on('data', this.listener)
    this.updateStatusDataStream({
      'Number of values sent since OIBus has started': this.canHandleValues ? 0 : undefined,
      'Number of files sent since OIBus has started': this.canHandleFiles ? 0 : undefined,
    })
  }

  /**
   * Method called by Engine to stop a given api. This method can be surcharged in the
   * North api implementation to allow disconnecting to a third party application for example.
   * @return {void}
   */
  async disconnect() {
    this.valueCache.stop()
    this.connected = false
    const { name, id } = this.application
    this.updateStatusDataStream({ 'Connected at': 'Not connected' })
    this.logger.info(`North API ${name} (${id}) disconnected`)
    this.engine.eventEmitters[`/north/${id}/sse`]?.events?.removeAllListeners()
    this.engine.eventEmitters[`/north/${id}/sse`]?.stream?.destroy()
  }

  /**
   * Method used by the eventEmitter of the current protocol to write data to the socket and send them to the frontend
   * @param {object} data - The json object of data to send
   * @return {void}
   */
  listener = (data) => {
    if (data) {
      this.engine.eventEmitters[`/north/${this.application.id}/sse`]?.stream?.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  updateStatusDataStream(statusData = {}) {
    this.statusData = { ...this.statusData, ...statusData }
    this.engine.eventEmitters[`/north/${this.application.id}/sse`].statusData = this.statusData
    this.engine.eventEmitters[`/north/${this.application.id}/sse`]?.events?.emit('data', this.statusData)
  }

  /**
   * Method called by the Engine to cache an array of values in order to cache them
   * and send them to a third party application.
   * @param {string} id - The data source id
   * @param {object[]} values - The values to handle
   * @return {Promise<void>} - The result
   */
  async cacheValues(id, values) {
    if (values.length) {
      await this.valueCache.cacheValues(id, values)
    }
  }

  /**
   * Method called by the Engine to cache an array of values in order to cache them
   * and send them to a third party application.
   * @param {String} cachePath - The path of the raw file
   * @param {number} timestamp - The timestamp the file was received
   * @return {Promise<void>} - The result
   */
  async cacheFile(cachePath, timestamp) {
    await this.fileCache.cacheFile(cachePath, timestamp)
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party application.
   * @param {object[]} values - The values to handle
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.warn(`handleValues should be surcharged ${values}`)
    return true
  }

  /**
   * Method called by the Engine to handle a raw file.
   * @param {string} filePath - The path of the raw file
   * @return {Promise} - The handle status
   */
  async handleFile(filePath) {
    this.logger.warn(`handleFile should be surcharged ${filePath}`)
    return true
  }

  /**
   * Get proxy by name
   * @param {String} proxyName - The name of the proxy
   * @return {*} - The proxy
   */
  getProxy(proxyName) {
    let proxy = null

    if (proxyName) {
      proxy = this.engineConfig.proxies.find(({ name }) => name === proxyName)
    }

    return proxy
  }

  /**
   * POST file.
   * @param {string} filePath - The path to the file to send
   * @returns {Promise} - The send status
   */
  async postFile(filePath) {
    return this.engine.requestService.httpSend(this.fileUrl, 'POST', this.authentication, this.proxy, filePath)
  }

  /**
   * POST data as JSON.
   * @param {object[]} values - The values to send
   * @returns {Promise} - The send status
   */
  async postJson(values) {
    const data = JSON.stringify(values)
    const headers = { 'Content-Type': 'application/json' }
    return this.engine.requestService.httpSend(this.valuesUrl, 'POST', this.authentication, this.proxy, data, headers)
  }

  /**
   * Check whether the North is subscribed to a South.
   * If subscribedTo is not defined or an empty array, the subscription is true.
   * @param {string} id - The data source id
   * @returns {boolean} - The North is subscribed to the given South
   */
  isSubscribed(id) {
    if (!Array.isArray(this.application.subscribedTo) || this.application.subscribedTo.length === 0) return true
    return this.application.subscribedTo.includes(id)
  }

  async getValueCacheStats() {
    return this.valueCache.getStats()
  }

  async getFileCacheStats() {
    return this.fileCache.getStats(this.application.name)
  }
}

module.exports = ApiHandler
