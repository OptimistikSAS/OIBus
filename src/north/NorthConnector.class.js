const fs = require('node:fs/promises')
const path = require('node:path')

const EncryptionService = require('../services/EncryptionService.class')
const Logger = require('../engine/logger/Logger.class')
const CertificateService = require('../services/CertificateService.class')
const StatusService = require('../services/status.service.class')
const ValueCache = require('../engine/cache/ValueCache.class')
const FileCache = require('../engine/cache/FileCache.class')
const { createFolder } = require('../services/utils')

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
   * @param {Object} settings - The North connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    this.canHandleValues = false
    this.canHandleFiles = false
    this.connected = false

    this.settings = settings
    this.engine = engine
    const { engineConfig } = this.engine.configService.getConfig()
    this.engineConfig = engineConfig
    this.encryptionService = EncryptionService.getInstance()
    this.baseFolder = path.resolve(this.engine.cacheFolder, `north-${settings.id}`)

    // Variable initialized in init()
    this.statusService = null
    this.valueCache = null
    this.fileCache = null
    this.logger = null
    this.certificate = null
    this.keyFile = null
    this.certFile = null
    this.caFile = null
    this.proxy = null
    this.authentication = null

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
   * Initialize services (logger, certificate, status data)
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    this.statusService = new StatusService()

    const { logParameters } = this.settings
    this.logger = new Logger(`North:${this.settings.name}`)
    this.logger.setEncryptionService(this.encryptionService)
    await this.logger.changeParameters(this.engineConfig, logParameters)

    await createFolder(this.baseFolder)

    this.valueCache = new ValueCache(
      this.settings.id,
      this.logger,
      this.baseFolder,
    )
    await this.valueCache.init()

    this.fileCache = new FileCache(
      this.settings.id,
      this.logger,
      this.baseFolder,
      this.settings.caching.archive.enabled,
      this.settings.caching.archive.retentionDuration,
    )
    await this.fileCache.init()

    this.certificate = new CertificateService(this.logger)
    await this.certificate.init(this.keyFile, this.certFile, this.caFile)

    this.statusService.updateStatusDataStream({
      'Number of values sent since OIBus has started': this.canHandleValues ? 0 : undefined,
      'Number of files sent since OIBus has started': this.canHandleFiles ? 0 : undefined,
    })

    if (this.settings.caching.sendInterval) {
      this.resetValuesTimeout(this.settings.caching.sendInterval)
      this.resetFilesTimeout(this.settings.caching.sendInterval)
    } else {
      this.logger.warn('No send interval. No values or files will be sent.')
    }
  }

  /**
   * Method called by Engine to initialize a North connector. This method can be surcharged in the
   * North connector implementation to allow connection to a third party application for example.
   * @param {String} additionalInfo - Connection information to display in the logger
   * @returns {Promise<void>} - The result promise
   */
  async connect(additionalInfo) {
    const { name, type } = this.settings
    this.connected = true
    this.statusService.updateStatusDataStream({ 'Connected at': new Date().toISOString() })
    if (additionalInfo) {
      this.logger.info(`North connector "${name}" of type ${type} started with ${additionalInfo}.`)
    } else {
      this.logger.info(`North connector "${name}" of type ${type} started.`)
    }
  }

  /**
   * Method called by Engine to stop a North connector. This method can be surcharged in the
   * North connector implementation to allow disconnecting to a third party application for example.
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    this.connected = false
    const { name, id } = this.settings
    this.statusService.updateStatusDataStream({ 'Connected at': 'Not connected' })
    this.logger.info(`North connector "${name}" (${id}) disconnected.`)

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

    const values = this.valueCache.retrieveValuesFromCache(this.settings.caching.maxSendCount)
    if (values.length === 0) {
      this.logger.trace('No values to send in the cache database.')
      this.resetValuesTimeout(this.settings.caching.sendInterval)
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

      if (this.valuesRetryCount < this.settings.caching.retryCount || this.shouldRetry(error)) {
        this.valuesRetryCount += 1
        this.logger.debug(`Retrying in ${this.settings.caching.retryInterval}. Retry count: ${this.valuesRetryCount}`)
      } else {
        this.logger.debug('Too many retries. Moving values to error cache...')
        this.valueCache.manageErroredValues(values)
        this.valuesRetryCount = 0
      }
    }
    this.sendingValuesInProgress = false

    let timeout = this.resendValuesImmediately ? 0 : this.settings.caching.sendInterval
    timeout = this.valuesRetryCount > 0 ? this.settings.caching.retryInterval : timeout
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
      this.logger.trace('No file to send in the cache database.')
      this.resetFilesTimeout(this.settings.caching.sendInterval)
      return
    }
    this.logger.trace(`File to send: "${fileToSend.path}".`)

    try {
      await fs.stat(fileToSend.path)
    } catch (error) {
      // File in cache does not exist on filesystem
      await this.fileCache.removeFileFromCache(fileToSend.path, false)
      this.logger.error(`File "${fileToSend.path}" not found! The file has been removed from the cache.`)
      this.resetFilesTimeout(this.settings.caching.sendInterval)
      return
    }

    this.sendingFilesInProgress = true
    this.resendFilesImmediately = false

    try {
      this.logger.debug(`Handling file "${fileToSend.path}".`)
      await this.handleFile(fileToSend.path)
      await this.fileCache.removeFileFromCache(fileToSend.path, this.settings.caching.archive.enabled)
      this.numberOfSentFiles += 1
      this.statusService.updateStatusDataStream({
        'Last uploaded file': fileToSend.path,
        'Number of files sent since OIBus has started': this.numberOfSentFiles,
        'Last upload at': new Date().toISOString(),
      })
      this.filesRetryCount = 0
    } catch (error) {
      this.logger.error(error)
      if (this.filesRetryCount < this.settings.caching.retryCount || this.shouldRetry(error)) {
        this.filesRetryCount += 1
        this.logger.debug(`Retrying in ${this.settings.caching.retryInterval}. Retry count: ${this.filesRetryCount}`)
      } else {
        this.logger.debug('Too many retries. Moving file to error cache...')
        await this.fileCache.manageErroredFiles(fileToSend.path)
        this.filesRetryCount = 0
      }
    }
    this.sendingFilesInProgress = false

    let timeout = this.resendFilesImmediately ? 0 : this.settings.caching.sendInterval
    timeout = this.filesRetryCount > 0 ? this.settings.caching.retryInterval : timeout
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
      if (count >= this.settings.caching.groupCount) {
        this.logger.trace(`Group count reached: ${count} >= ${this.settings.caching.groupCount}`)
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
   * @return {Object} - The proxy
   */
  getProxy(proxyName) {
    return proxyName ? this.engineConfig.proxies.find(({ name }) => name === proxyName) : null
  }

  /**
   * Check whether the North is subscribed to a South.
   * If subscribedTo is not defined or an empty array, the subscription is true.
   * @param {String} southId - The South connector id
   * @returns {Boolean} - The North is subscribed to the given South
   */
  isSubscribed(southId) {
    if (!Array.isArray(this.settings.subscribedTo) || this.settings.subscribedTo.length === 0) return true
    return this.settings.subscribedTo.includes(southId)
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
