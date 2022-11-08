const path = require('node:path')

const EncryptionService = require('../service/encryption.service')
const LoggerService = require('../service/logger/logger.service')
const CertificateService = require('../service/certificate.service')
const StatusService = require('../service/status.service')
const ValueCache = require('../engine/cache/value-cache')
const FileCache = require('../engine/cache/file-cache')
const { createFolder } = require('../service/utils')
const { createProxyAgent } = require('../service/http-request-static-functions')

/**
 * Class NorthConnector : provides general attributes and methods for north connectors.
 * Building a new North connector means to extend this class, and to surcharge
 * the following methods:
 * - **handleValues**: receive an array of values that need to be sent to an external application
 * - **handleFile**: receive a file that need to be sent to an external application.
 * - **connect** (optional): to allow establishing proper connection to the external application
 * - **disconnect** (optional): to allow proper disconnection
 *
 * The constructor of the API need to initialize:
 * - **this.canHandleValues** to true in order to receive values with handleValues()
 * - **this.canHandleFiles** to true in order to receive a file with handleFile()
 *
 * In addition, it is possible to use a number of helper functions:
 * - **getProxy**: get the proxy handler
 * - **logger**: to log an event with different levels (error,warning,info,debug,trace)
 */
class NorthConnector {
  /**
   * Constructor for NorthConnector
   * @constructor
   * @param {Object} configuration - The North connector settings
   * @param {Object[]} proxies - The list of available proxies
   * @return {void}
   */
  constructor(
    configuration,
    proxies,
  ) {
    this.canHandleValues = false
    this.canHandleFiles = false
    this.connected = false

    this.id = configuration.id
    this.type = configuration.type
    this.name = configuration.name
    this.logParameters = configuration.logParameters
    this.caching = configuration.caching
    this.subscribedTo = configuration.subscribedTo
    this.proxies = proxies

    this.encryptionService = EncryptionService.getInstance()

    // Variable initialized in init()
    this.baseFolder = null
    this.statusService = null
    this.valueCache = null
    this.fileCache = null
    this.logger = null
    this.certificate = null
    this.keyFile = null
    this.certFile = null
    this.caFile = null
    this.authentication = null
    this.proxySettings = null
    this.proxyAgent = null

    this.numberOfSentValues = 0
    this.valuesTimeout = null
    this.valuesRetryCount = 0
    this.sendingValuesInProgress = false
    this.resendValuesImmediately = false

    this.numberOfSentFiles = 0
    this.filesTimeout = null
    this.filesRetryCount = 0
    this.sendingFilesInProgress = false
    this.resendFilesImmediately = false
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @param {Object} defaultLogParameters - The default logs parameters
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName, defaultLogParameters) {
    this.baseFolder = path.resolve(baseFolder, `north-${this.id}`)

    this.statusService = new StatusService()
    this.logger = new LoggerService(`North:${this.name}`)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(oibusName, defaultLogParameters, this.logParameters)

    await createFolder(this.baseFolder)

    this.valueCache = new ValueCache(
      this.id,
      this.logger,
      this.baseFolder,
    )
    await this.valueCache.init()

    this.fileCache = new FileCache(
      this.id,
      this.logger,
      this.baseFolder,
      this.caching.archive.enabled,
      this.caching.archive.retentionDuration,
    )
    await this.fileCache.init()

    this.certificate = new CertificateService(this.logger)
    await this.certificate.init(this.keyFile, this.certFile, this.caFile)

    this.statusService.updateStatusDataStream({
      'Number of values sent since OIBus has started': this.canHandleValues ? 0 : undefined,
      'Number of files sent since OIBus has started': this.canHandleFiles ? 0 : undefined,
    })

    if (this.caching.sendInterval) {
      this.resetValuesTimeout(this.caching.sendInterval)
      this.resetFilesTimeout(this.caching.sendInterval)
    } else {
      this.logger.warn('No send interval. No values or files will be sent.')
    }

    this.proxyAgent = await this.getProxy(this.proxySettings)
  }

  /**
   * Stop services and timer
   * @returns {Promise<void>} - The result promise
   */
  async stop() {
    this.logger.info(`Stopping North "${this.name}" (${this.id}).`)
    await this.disconnect()

    this.numberOfSentValues = 0
    this.valuesRetryCount = 0
    this.sendingValuesInProgress = false
    this.resendValuesImmediately = false

    this.numberOfSentFiles = 0
    this.filesRetryCount = 0
    this.sendingFilesInProgress = false
    this.resendFilesImmediately = false

    if (this.valuesTimeout) {
      clearTimeout(this.valuesTimeout)
    }
    if (this.filesTimeout) {
      clearTimeout(this.filesTimeout)
    }
    this.fileCache.stop()
    this.valueCache.stop()
  }

  /**
   * Method called by Engine to initialize a North connector. This method can be surcharged in the
   * North connector implementation to allow connection to a third party application for example.
   * @param {String} additionalInfo - Connection information to display in the logger
   * @returns {Promise<void>} - The result promise
   */
  async connect(additionalInfo) {
    this.connected = true
    this.statusService.updateStatusDataStream({ 'Connected at': new Date().toISOString() })
    if (additionalInfo) {
      this.logger.info(`North connector "${this.name}" of type ${this.type} started with ${additionalInfo}.`)
    } else {
      this.logger.info(`North connector "${this.name}" of type ${this.type} started.`)
    }
  }

  /**
   * Method called by Engine to stop a North connector. This method can be surcharged in the
   * North connector implementation to allow disconnecting to a third party application for example.
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    this.connected = false
    this.statusService.updateStatusDataStream({ 'Connected at': 'Not connected' })
    this.logger.info(`North connector "${this.name}" (${this.id}) disconnected.`)
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party application.
   * @returns {Promise<void>} - The result promise
   */
  async retrieveFromCacheAndSendValues() {
    if (this.sendingValuesInProgress) {
      this.logger.trace('Already sending values...')
      this.resendValuesImmediately = true
      return
    }

    const values = this.valueCache.retrieveValuesFromCache(this.caching.maxSendCount)
    if (values.length === 0) {
      this.logger.trace('No values to send in the cache database.')
      this.resetValuesTimeout(this.caching.sendInterval)
      return
    }

    this.sendingValuesInProgress = true
    this.resendValuesImmediately = false

    try {
      this.logger.debug(`Handling ${values.length} values.`)
      await this.handleValues(values)
      this.valueCache.removeValuesFromCache(values)
      this.numberOfSentValues += values.length
      this.statusService.updateStatusDataStream({
        'Last handled values at': new Date().toISOString(),
        'Number of values sent since OIBus has started': this.numberOfSentValues,
        'Last added point id (value)': `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`,
      })
      this.valuesRetryCount = 0
    } catch (error) {
      this.logger.error(error)

      if (this.valuesRetryCount < this.caching.retryCount || this.shouldRetry(error)) {
        this.valuesRetryCount += 1
        this.logger.debug(`Retrying in ${this.caching.retryInterval} ms. Retry count: ${this.valuesRetryCount}`)
      } else {
        this.logger.debug('Too many retries. Moving values to error cache...')
        this.valueCache.manageErroredValues(values)
        this.valuesRetryCount = 0
      }
    }
    this.sendingValuesInProgress = false

    let timeout = this.resendValuesImmediately ? 0 : this.caching.sendInterval
    timeout = this.valuesRetryCount > 0 ? this.caching.retryInterval : timeout
    this.resetValuesTimeout(timeout)
  }

  /**
   * Reset timer.
   * @param {number} timeout - The timeout to wait
   * @return {void}
   */
  resetValuesTimeout(timeout) {
    if (this.valuesTimeout) {
      clearTimeout(this.valuesTimeout)
    }
    this.valuesTimeout = setTimeout(this.retrieveFromCacheAndSendValues.bind(this), timeout)
  }

  /**
   * Method called by the Engine to handle a raw file.
   * @returns {Promise<void>} - The result promise
   */
  async retrieveFromCacheAndSendFile() {
    if (this.sendingFilesInProgress) {
      this.logger.trace('Already sending files...')
      this.resendFilesImmediately = true
      return
    }

    const fileToSend = await this.fileCache.retrieveFileFromCache()
    if (!fileToSend) {
      this.logger.trace('No file to send in the cache folder.')
      this.resetFilesTimeout(this.caching.sendInterval)
      return
    }
    this.logger.trace(`File to send: "${fileToSend.path}".`)

    this.sendingFilesInProgress = true
    this.resendFilesImmediately = false

    try {
      this.logger.debug(`Handling file "${fileToSend.path}".`)
      await this.handleFile(fileToSend.path)
      await this.fileCache.removeFileFromCache(fileToSend.path, this.caching.archive.enabled)
      this.numberOfSentFiles += 1
      this.statusService.updateStatusDataStream({
        'Last uploaded file': fileToSend.path,
        'Number of files sent since OIBus has started': this.numberOfSentFiles,
        'Last upload at': new Date().toISOString(),
      })
      this.filesRetryCount = 0
    } catch (error) {
      this.logger.error(error)
      if (this.filesRetryCount < this.caching.retryCount || this.shouldRetry(error)) {
        this.filesRetryCount += 1
        this.logger.debug(`Retrying in ${this.caching.retryInterval} ms. Retry count: ${this.filesRetryCount}`)
      } else {
        this.logger.debug('Too many retries. Moving file to error cache...')
        await this.fileCache.manageErroredFiles(fileToSend.path)
        this.filesRetryCount = 0
      }
    }
    this.sendingFilesInProgress = false

    let timeout = this.resendFilesImmediately ? 0 : this.caching.sendInterval
    timeout = this.filesRetryCount > 0 ? this.caching.retryInterval : timeout
    this.resetFilesTimeout(timeout)
  }

  /**
   * Reset timer.
   * @param {number} timeout - The timeout to wait
   * @return {void}
   */
  resetFilesTimeout(timeout) {
    if (this.filesTimeout) {
      clearTimeout(this.filesTimeout)
    }
    this.filesTimeout = setTimeout(this.retrieveFromCacheAndSendFile.bind(this), timeout)
  }

  /**
   * Method called by the Engine to cache an array of values in order to cache them
   * and send them to a third party application.
   * @param {String} southId - The South connector id
   * @param {Object[]} values - The values to handle
   * @returns {void} - The result promise
   */
  cacheValues(southId, values) {
    if (values.length > 0) {
      this.valueCache.cacheValues(southId, values)

      // If the group size is over the groupCount => we immediately send the cache
      // to the North even if the timeout is not finished.
      const count = this.valueCache.getNumberOfValues()
      if (count >= this.caching.groupCount) {
        this.logger.trace(`Group count reached: ${count} >= ${this.caching.groupCount}`)
        this.resetValuesTimeout(0)
      }
    }
  }

  /**
   * Method called by the Engine to cache a file and send them to a third party application.
   * @param {String} filePath - The path of the raw file
   * @returns {Promise<void>} - The result promise
   */
  async cacheFile(filePath) {
    await this.fileCache.cacheFile(filePath)
  }

  /**
   * Get proxy by name
   * @param {String} proxyName - The name of the proxy
   * @return {Promise<Object>} - The proxy
   */
  async getProxy(proxyName) {
    if (!proxyName) return null
    const foundProxy = this.proxies.find(({ name }) => name === proxyName)
    if (foundProxy) {
      return createProxyAgent(
        foundProxy.protocol,
        foundProxy.host,
        foundProxy.port,
        foundProxy.username,
        await this.encryptionService.decryptText(foundProxy.password || ''),
      )
    }
    return null
  }

  /**
   * Check whether the North is subscribed to a South.
   * If subscribedTo is not defined or an empty array, the subscription is true.
   * @param {String} southId - The South connector id
   * @returns {Boolean} - The North is subscribed to the given South
   */
  isSubscribed(southId) {
    if (!Array.isArray(this.subscribedTo) || this.subscribedTo.length === 0) return true
    return this.subscribedTo.includes(southId)
  }

  /**
   * Default should retry method, to override for specific North implementation
   * @param {Object} _error - The error caught in the handleFile and handleValues methods
   * @returns {Boolean} - If the file or values must be sent again or not
   */
  shouldRetry(_error) {
    this.logger.trace('Default retry test always return false.')
    return false
  }

  /**
   * Check appropriate caches emptiness
   * @returns {Promise<Boolean>} - True if North cache is empty, false otherwise
   */
  async isCacheEmpty() {
    const isValueCacheEmpty = this.valueCache.isEmpty()
    const isFileCacheEmpty = await this.fileCache.isEmpty()
    return isValueCacheEmpty && isFileCacheEmpty
  }
}

module.exports = NorthConnector
