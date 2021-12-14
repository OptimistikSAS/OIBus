const EventEmitter = require('events')

const EncryptionService = require('../services/EncryptionService.class')
const Logger = require('../engine/Logger.class')

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
   * - **connect**: to allow to establish proper connection to the external application (optional)
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
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    this.canHandleValues = false
    this.canHandleFiles = false

    this.encryptionService = EncryptionService.getInstance()

    this.application = applicationParameters
    this.engine = engine
    this.scanModes = this.engine.scanModes
    const { engineConfig } = this.engine.configService.getConfig()
    this.engineConfig = engineConfig

    const { logParameters } = this.application
    this.logger = new Logger()
    this.logger.changeParameters(this.engineConfig, logParameters)
    this.statusData = {}
  }

  /**
   * Method called by Engine to initialize a given api. This method can be surcharged in the
   * North api implementation to allow connection to a third party application for example.
   * @return {void}
   */
  connect() {
    const { name, api } = this.application
    this.logger.info(`North API ${name} started with protocol ${api}`)
  }

  initializeStatusData() {
    const initialStatusData = { }
    if (this.canHandleValues) {
      initialStatusData['Number of values sent since OIBus has started'] = 0
    }
    if (this.canHandleFiles) {
      initialStatusData['Number of files sent since OIBus has started'] = 0
    }
    this.statusData = initialStatusData
    if (!this.engine.eventEmitters[`/north/${this.application.id}/sse`]) {
      this.engine.eventEmitters[`/north/${this.application.id}/sse`] = {}
      this.engine.eventEmitters[`/north/${this.application.id}/sse`].events = new EventEmitter()
      this.engine.eventEmitters[`/north/${this.application.id}/sse`].events.setMaxListeners(0)
      this.engine.eventEmitters[`/north/${this.application.id}/sse`].events.on('data', this.listener)
      this.engine.eventEmitters[`/north/${this.application.id}/sse`].statusData = this.statusData
      this.updateStatusDataStream()
    }
  }

  /**
   * Method called by Engine to stop a given api. This method can be surcharged in the
   * North api implementation to allow to disconnect to a third party application for example.
   * @return {void}
   */
  disconnect() {
    const { name, id } = this.application
    this.logger.info(`North API ${name} (${id}) disconnected`)
    this.engine.eventEmitters[`/north/${id}/sse`]?.events?.off('data', this.listener)
  }

  listener = (data) => {
    if (data) this.engine.eventEmitters[`/north/${this.application.id}/sse`]?.stream?.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  updateStatusDataStream() {
    this.engine.eventEmitters[`/north/${this.application.id}/sse`]?.events?.emit('data', this.statusData)
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party application.
   * @param {object[]} values - The values to handle
   * @return {Promise} - The handle status
   */
  /* eslint-disable-next-line class-methods-use-this */
  async handleValues(values) {
    this.logger.warn(`handleValues should be surcharged ${values}`)
    return true
  }

  /**
   * Method called by the Engine to handle a raw file.
   * @param {string} filePath - The path of the raw file
   * @return {Promise} - The handle status
   */
  /* eslint-disable-next-line class-methods-use-this */
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
   *
   * @param {string} filePath - The path to the file to send
   * @returns {Promise} - The send status
   */
  async postFile(filePath) {
    return this.engine.requestService.httpSend(this.fileUrl, 'POST', this.authentication, this.proxy, filePath)
  }

  /**
   * POST data as JSON.
   *
   * @param {object[]} values - The values to send
   * @returns {Promise} - The send status
   */
  async postJson(values) {
    const data = JSON.stringify(values)
    const headers = { 'Content-Type': 'application/json' }
    return this.engine.requestService.httpSend(this.valuesUrl, 'POST', this.authentication, this.proxy, data, headers)
  }
}

module.exports = ApiHandler
