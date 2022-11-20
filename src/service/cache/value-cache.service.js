const fs = require('node:fs/promises')
const path = require('node:path')

const { nanoid } = require('nanoid')

const { createFolder, filesExists } = require('../utils')
const DeferredPromise = require('../deferred-promise')

const BUFFER_MAX = 250
const BUFFER_TIMEOUT = 300
const RESEND_IMMEDIATELY_TIMEOUT = 100

const VALUE_FOLDER = 'values'
const ERROR_FOLDER = 'values-errors'

const BUFFER_FILE_NAME = 'buffer.tmp'

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
class ValueCacheService {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} baseFolder - The North cache folder generated as north-connectorId. This base folder can
   * be in data-stream or history-query folder depending on the connector use case
   * @param {Function} northSendValuesCallback - Method used by the North to handle values
   * @param {Function} northShouldRetryCallback - Method used by the North to retry or not the sending
   * @param {Object} settings - Cache settings
   * @return {void}
   */
  constructor(
    northId,
    logger,
    baseFolder,
    northSendValuesCallback,
    northShouldRetryCallback,
    settings,
  ) {
    this.northId = northId
    this.logger = logger
    this.baseFolder = baseFolder
    this.northSendValuesCallback = northSendValuesCallback
    this.northShouldRetryCallback = northShouldRetryCallback
    this.settings = settings

    this.flushBuffer = []
    this.bufferTimeout = null
    this.valuesTimeout = null
    this.queue = new Map() // key: queue filename (randomId.queue.tmp, value: the values in the queue file
    this.compactedQueue = [] // List of object {fileName, creationAt, numberOfValues} fileName: compact filename (randomId.compact.tmp)
    this.sendingValuesInProgress = false
    this.sendNextImmediately = false
    this.valuesRetryCount = 0
    this.sendingValues$ = null
    this.valuesBeingSent = null

    this.valueFolder = path.resolve(this.baseFolder, VALUE_FOLDER)
    this.errorFolder = path.resolve(this.baseFolder, ERROR_FOLDER)
  }

  /**
   * Create folders, read the cache folders to initialize the flushBuffer, queue and compactQueue
   * It also counts the values stored in the cache and log it.
   * If a file is corrupted or malformed, an error is logged and the file is ignored
   * @returns {Promise<void>} - The result promise
   */
  async start() {
    await createFolder(this.valueFolder)
    await createFolder(this.errorFolder)

    const files = await fs.readdir(this.valueFolder)

    // Take buffer.tmp file data into this.flushBuffer
    this.flushBuffer = []

    if (await filesExists(path.resolve(this.valueFolder, BUFFER_FILE_NAME))) {
      try {
        const bufferFileContent = await fs.readFile(path.resolve(this.valueFolder, BUFFER_FILE_NAME), { encoding: 'utf8' })
        this.flushBuffer = JSON.parse(bufferFileContent)
      } catch (error) {
        this.logger.error(error)
      }
    }

    let numberOfValuesInCache = 0
    // Filters file that don't match the regex (keep queue.tmp files only)
    const queueFiles = files.filter((file) => file.match(/.*.queue.tmp/))
    await queueFiles.reduce((promise, fileName) => promise.then(
      async () => {
        try {
          const fileContent = await fs.readFile(path.resolve(this.valueFolder, fileName), { encoding: 'utf8' })
          const values = JSON.parse(fileContent)
          this.queue.set(fileName, values)
          numberOfValuesInCache += values.length
        } catch (error) {
          // If a file is being written or corrupted, the readFile method can fail
          // An error is logged and the cache goes through the other files
          this.logger.error(`Error while reading queue file "${path.resolve(this.valueFolder, fileName)}": ${error}`)
        }
      },
    ), Promise.resolve())

    // Filters file that don't match the regex (keep compact.tmp files only)
    const compactedQueueFiles = files.filter((file) => file.match(/.*.compact.tmp/))
    this.compactedQueue = []
    await compactedQueueFiles.reduce((promise, fileName) => promise.then(
      async () => {
        try {
          const fileStat = await fs.stat(path.resolve(this.valueFolder, fileName))
          const fileContent = await fs.readFile(path.resolve(this.valueFolder, fileName), { encoding: 'utf8' })
          const values = JSON.parse(fileContent)
          this.compactedQueue.push({ fileName, createdAt: fileStat.ctimeMs, numberOfValues: values.length })
          numberOfValuesInCache += values.length
        } catch (error) {
          // If a file is being written or corrupted, the stat method can fail
          // An error is logged and the cache goes through the other files
          this.logger.error(`Error while reading queue file "${path.resolve(this.valueFolder, fileName)}": ${error}`)
        }
      },
    ), Promise.resolve())
    // Sort the compact queue to have the oldest file first
    this.compactedQueue.sort((a, b) => a.createdAt - b.createdAt)
    if (numberOfValuesInCache > 0) {
      this.logger.info(`${numberOfValuesInCache} values in cache.`)
    } else {
      this.logger.info('No value in cache.')
    }

    if (this.settings.sendInterval) {
      this.resetValuesTimeout(this.settings.sendInterval)
    } else {
      this.logger.warn('No send interval. No values will be sent.')
    }
  }

  /**
   * Method used to flush the buffer from a time trigger or a max trigger
   * Flushing the buffer create a queue file and keep the values in memory for sending them
   * @param {'time-flush' | 'max-flush'} flag - The trigger
   * @returns {Promise<void>} - The result promise
   */
  async flush(flag = 'time-flush') {
    if (flag === 'max-flush') {
      clearTimeout(this.bufferTimeout)
    }
    // Reset timeout to null to set the buffer timeout again on the next send values
    this.bufferTimeout = null

    // Save the buffer to be sent and immediately clear it
    if (this.flushBuffer.length === 0) {
      this.logger.trace(`Nothing to flush (${flag}).`)
      return
    }

    this.logger.trace(`Flush ${this.flushBuffer.length} values (${flag}).`)
    const bufferSave = [...this.flushBuffer]
    this.flushBuffer = []
    const tmpFileName = `${nanoid()}.queue.tmp`
    await fs.rename(path.resolve(this.valueFolder, BUFFER_FILE_NAME), path.resolve(this.valueFolder, tmpFileName))
    this.queue.set(tmpFileName, bufferSave)

    let groupCount = 0
    this.queue.forEach((values) => {
      groupCount += values.length
    })
    if (groupCount >= this.settings.maxSendCount) {
      const copiedQueue = this.queue
      await this.compactQueueCache(copiedQueue)
    }

    if (groupCount >= this.settings.groupCount) {
      await this.sendValuesWrapper('group-count')
    }
  }

  /**
   * Take values from the queue and store them in a compact file
   * @param {Map} cacheQueue - The copied queue to compact
   * @returns {Promise<void>} - The result promise
   */
  async compactQueueCache(cacheQueue) {
    const valuesInQueue = []

    cacheQueue.forEach((values, key) => {
      valuesInQueue.push({ key, values })
    })
    const compactFileName = `${nanoid()}.compact.tmp`
    this.logger.trace(`Max group count reach. Compacting queue into "${compactFileName}".`)
    try {
      const compactValues = valuesInQueue.reduce((prev, { values }) => {
        prev.push(...values)
        return prev
      }, [])
      // Store the values in a tmp file
      await fs.writeFile(
        path.resolve(this.valueFolder, compactFileName),
        JSON.stringify(compactValues),
        { encoding: 'utf8', flag: 'w' },
      )
      this.compactedQueue.push({
        fileName: compactFileName,
        createdAt: new Date().getTime(),
        numberOfValues: compactValues.length,
      })

      // Once compacted, remove values from queue.
      await valuesInQueue.reduce((promise, { key }) => promise.then(
        async () => this.deleteKeyFromCache(key),
      ), Promise.resolve())
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Wrapper for the send value method to catch an error when used in a timer
   * @param {'timer' | 'group-count'} flag - What is the source of the function call
   * @returns {Promise<void>} - The result promise
   */
  async sendValuesWrapper(flag = 'timer') {
    try {
      await this.sendValues(flag)
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Send the values if not already being sent. The values are retrieved from the cache (queue or compacted queue)
   * @param {'timer' | 'group-count'} flag - What is the source of the function call
   * @returns {Promise<void>} - The result promise
   */
  async sendValues(flag) {
    this.logger.trace(`Sending values (${flag}).`)

    if (this.sendingValuesInProgress) {
      this.logger.trace('Already sending values...')
      if (flag === 'group-count') {
        this.sendNextImmediately = true
      }
      return
    }

    // If no values are already set to be sent, retrieve them
    // It may happen that valuesToSend is already set, especially when the northSendValues
    // fails. In this case, the cache must retry until it manages the error and reset valuesBeingSent
    this.sendingValuesInProgress = true
    // This deferred promise allows the connector to wait for the end of this method before stopping
    this.sendingValues$ = new DeferredPromise()
    if (!this.valuesBeingSent) {
      this.valuesBeingSent = await this.getValuesToSend()
    }

    if (this.valuesBeingSent.length === 0) {
      this.logger.trace('No value to send...')
      this.valuesBeingSent = null
      this.sendingValuesInProgress = false
      this.sendingValues$.resolve()
      this.resetValuesTimeout(this.settings.sendInterval)
      return
    }

    // Transform the values to send into an array of values objects to handle them in the North connector
    const listOfValuesToSend = this.valuesBeingSent.reduce((prev, { values }) => {
      prev.push(...values)
      return prev
    }, [])
    this.logger.debug(`Handling ${listOfValuesToSend.length} values.`)
    try {
      await this.northSendValuesCallback(listOfValuesToSend)
      this.logger.debug(`${listOfValuesToSend.length} values sent.`)

      // Remove the values with the key (filename) embedded in the this.valuesToSend variable
      await this.removeSentValues(this.valuesBeingSent)
      // Reset the valuesToSend to retrieve the next values to send at the next call
      this.valuesBeingSent = null
      this.valuesRetryCount = 0
    } catch (error) {
      this.logger.error(`Error when sending values (retry ${this.valuesRetryCount}): ${error}`)
      if (this.valuesRetryCount < this.settings.retryCount || this.northShouldRetryCallback(error)) {
        this.valuesRetryCount += 1
        this.logger.debug(`Retrying values in ${this.settings.retryInterval} ms. Retry count: ${this.valuesRetryCount}`)
      } else {
        this.logger.debug('Too many retries. The values won\'t be sent again.')

        this.logger.trace(`Moving ${listOfValuesToSend.length} values into error cache: "${this.errorFolder}".`)
        await this.manageErroredValues(this.valuesBeingSent)

        this.valuesBeingSent = null
        this.valuesRetryCount = 0
      }
    }

    if (this.sendNextImmediately) {
      this.resetValuesTimeout(RESEND_IMMEDIATELY_TIMEOUT)
    } else {
      this.resetValuesTimeout(this.valuesRetryCount > 0 ? this.settings.retryInterval : this.settings.sendInterval)
    }
    this.sendingValuesInProgress = false
    this.sendingValues$.resolve()
  }

  /**
   * Retrieve the values from the queue or the compacted cache
   * @returns {Promise<{ key: string, values: Object[]}[]>} - The values to send associated to the key (reference in
   * the queue Map and filename where the data are persisted on disk)
   */
  async getValuesToSend() {
    // If there is no file in the compacted queue, the values are retrieved from the regular queue
    if (this.compactedQueue.length === 0) {
      const valuesInQueue = []
      this.logger.trace('Retrieving values from queue.')
      this.queue.forEach((values, key) => {
        valuesInQueue.push({ key, values })
      })
      return valuesInQueue
    }
    // Otherwise, get the first element from the compacted queue and retrieve the values from the file
    const [queueFile] = this.compactedQueue
    try {
      this.logger.trace(`Retrieving values from ${path.resolve(this.valueFolder, queueFile.fileName)}.`)
      const fileContent = await fs.readFile(path.resolve(this.valueFolder, queueFile.fileName), { encoding: 'utf8' })
      return [{ key: queueFile.fileName, values: JSON.parse(fileContent) }]
    } catch (err) {
      this.logger.error(`Error while reading compacted file "${queueFile.fileName}": ${err}`)
      return []
    }
  }

  /**
   * Remove the values from the queue
   * @param {{key: String, values: Object[]}[]} sentValues - The key is the filename to remove from disk and the Map key to remove from the queue.
   * Values are not used in this case
   * @returns {Promise<void>} - The result promise
   */
  async removeSentValues(sentValues) {
    await sentValues.reduce((promise, { key }) => promise.then(
      async () => this.deleteKeyFromCache(key),
    ), Promise.resolve())
  }

  /**
   * Remove the key (filename) from the queues if it exists and remove the associated file
   * @param {String} key - The key is a filename used as key in the compactedQueue and the queue Maps
   * @returns {Promise<void>} - The result promise
   */
  async deleteKeyFromCache(key) {
    // Remove values from queues
    const indexToRemove = this.compactedQueue.findIndex((queueFile) => queueFile.fileName === key)
    if (indexToRemove > -1) {
      this.compactedQueue.splice(indexToRemove, 1)
    }
    this.queue.delete(key)

    // Remove file from disk
    try {
      this.logger.trace(`Removing "${path.resolve(this.valueFolder, key)}" from cache.`)
      await fs.unlink(path.resolve(this.valueFolder, key))
    } catch (err) {
      // Catch error locally to not block the removal of other files
      this.logger.error(`Error while removing file "${path.resolve(this.valueFolder, key)}" from cache: ${err}`)
    }
  }

  /**
   * Remove values from North connector cache and save them to the values error cache db
   * @param {Object[]} values - The values to remove
   * @return {Promise<void>} - The result promise
   */
  async manageErroredValues(values) {
    await values.reduce((promise, { key }) => promise.then(
      async () => {
        // Remove values from queues
        const indexToRemove = this.compactedQueue.findIndex((queueFile) => queueFile.fileName === key)
        if (indexToRemove > -1) {
          this.compactedQueue.splice(indexToRemove, 1)
        }
        this.queue.delete(key)

        const filePath = path.parse(key)
        try {
          this.logger.trace(`Moving "${path.resolve(this.valueFolder, key)}" to error cache: "${path.resolve(this.errorFolder, filePath.base)}".`)
          await fs.rename(path.resolve(this.valueFolder, key), path.resolve(this.errorFolder, filePath.base))
        } catch (err) {
          // Catch error locally to let OIBus moving the other files.
          this.logger.error(`Error while moving file "${path.resolve(this.valueFolder, key)}" into cache error `
              + `"${path.resolve(this.errorFolder, filePath.base)}": ${err}`)
        }
      },
    ), Promise.resolve())
  }

  /**
   * Persist values into a tmp file and keep them in a local buffer to flush them in the queue later
   * @param {Object[]} values - The values to cache
   * @returns {Promise<void>} - The result promise
   */
  async cacheValues(values) {
    this.flushBuffer.push(...values)
    // Immediately write the values into the buffer.tmp file to persist them on disk
    await fs.writeFile(
      path.resolve(this.valueFolder, BUFFER_FILE_NAME),
      JSON.stringify(this.flushBuffer),
      { encoding: 'utf8' },
    )
    if (this.flushBuffer.length > BUFFER_MAX) {
      await this.flush('max-flush')
    } else if (this.bufferTimeout === null) {
      this.bufferTimeout = setTimeout(this.flush.bind(this), BUFFER_TIMEOUT)
    }
  }

  /**
   * Check if the value cache is empty or not
   * @returns {Promise<Boolean>} - Cache empty or not
   */
  async isEmpty() {
    let files = []
    try {
      files = await fs.readdir(this.valueFolder)
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this.logger.error(error)
    }
    return files.length === 0
  }

  /**
   * Reset timer.
   * @param {number} timeout - The timeout to wait
   * @return {void}
   */
  resetValuesTimeout(timeout) {
    clearTimeout(this.valuesTimeout)
    this.valuesTimeout = setTimeout(this.sendValuesWrapper.bind(this), timeout)
  }

  /**
   * Close the databases
   * @return {Promise<void>} - The result promise
   */
  async stop() {
    if (this.sendingValues$) {
      this.logger.debug('Waiting for connector to finish sending values...')
      await this.sendingValues$.promise
    }
    clearTimeout(this.bufferTimeout)
    clearTimeout(this.valuesTimeout)
  }
}

module.exports = ValueCacheService
