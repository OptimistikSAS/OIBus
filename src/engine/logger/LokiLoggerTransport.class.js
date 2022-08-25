const fetch = require('node-fetch')
const build = require('pino-abstract-transport')

const MAX_BATCH_LOG = 500
const MAX_BATCH_INTERVAL_S = 60
const LEVEL_FORMAT = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' }

/**
 * Class to support logging to a remote loki instance as a custom Pino Transport module
 * @class LokiTransport
 */
class LokiTransport {
  constructor(options) {
    this.token = null
    this.mustRenewToken = true
    this.mustRenewTokenTimeout = null
    this.username = options.username
    this.password = options.password
    this.tokenAddress = options.tokenAddress
    this.lokiAddress = options.lokiAddress
    this.engineName = options.engineName
    this.interval = options.interval || MAX_BATCH_INTERVAL_S
    this.batchLimit = options.batchLimit || MAX_BATCH_LOG
    this.batchLogs = {
      60: [],
      50: [],
      40: [],
      30: [],
      20: [],
      10: [],
    }
    this.sendLokiLogsInterval = setInterval(async () => {
      await this.sendLokiLogs()
    }, this.interval * 1000)
  }

  /**
   * Method used to send the log to the remote loki instance
   * @returns {Promise<void>} - The result promise
   */
  sendLokiLogs = async () => {
    const streams = []
    Object.entries(this.batchLogs).forEach(([logLevel, logMessages]) => {
      if (logMessages.length > 0) {
        logMessages.forEach((logMessage) => {
          const jsonMessage = JSON.parse(logMessage[1])
          streams.push({
            stream: {
              oibus: this.engineName,
              level: LEVEL_FORMAT[logLevel],
              scope: jsonMessage.scope,
              source: jsonMessage.source,
            },
            values: [[logMessage[0], jsonMessage.message]],
          })
        })
      }
    })
    if (streams.length === 0) {
      return
    }
    const dataBuffer = JSON.stringify({ streams })
    this.batchLogs = {
      60: [],
      50: [],
      40: [],
      30: [],
      20: [],
      10: [],
    }

    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dataBuffer,
    }

    if (this.tokenAddress) {
      if (this.mustRenewToken || !this.token) {
        await this.updateLokiToken()
      }
      if (!this.token) {
        return
      }
      fetchOptions.headers.Authorization = `Bearer ${this.token.access_token}`
    } else if (this.username && this.password) {
      const basic = Buffer.from(`${this.username}:${this.password}`).toString('base64')
      fetchOptions.headers.Authorization = `Basic ${basic}`
    }
    try {
      const result = await fetch(this.lokiAddress, fetchOptions)

      if (result.status !== 200 && result.status !== 201 && result.status !== 204) {
        console.error(`Loki fetch error: ${result.status} - ${result.statusText} with payload ${dataBuffer}`)
      }
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Method used to update the token if needed
   * @returns {Promise<void>} - The result promise
   */
  updateLokiToken = async () => {
    try {
      const basic = Buffer.from(`${this.username}:${this.password}`).toString('base64')
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        timeout: 10000,
      }
      const response = await fetch(this.tokenAddress, fetchOptions)
      const responseData = await response.json()

      if (this.mustRenewTokenTimeout) {
        clearTimeout(this.mustRenewTokenTimeout)
      }
      this.mustRenewTokenTimeout = setTimeout(() => {
        this.mustRenewToken = true
      }, (responseData.expires_in - 60) * 1000)
      this.token = responseData
      this.mustRenewToken = false
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Store the log in the batch log array and send them immediately if the array is full
   * @param {Object} log - the log to send
   * @returns {Promise<void>} - The result promise
   */
  addLokiLogs = async (log) => {
    this.batchLogs[log.level].push([(new Date(log.time).getTime() * 1000000).toString(),
      JSON.stringify({ message: log.msg, scope: log.scope, source: log.source })])
    if (this.batchLogs.length >= this.batchLimit) {
      if (this.sendLokiLogsInterval) {
        clearInterval(this.sendLokiLogsInterval)
      }
      await this.sendLokiLogs()
      this.sendLokiLogsInterval = setInterval(async () => {
        await this.sendLokiLogs()
      }, this.interval * 1000)
    }
  }

  /**
   * Clear timeout and interval and send last logs before closing the transport
   * @returns {Promise<void>} - The result promise
   */
  end = async () => {
    if (this.sendLokiLogsInterval) {
      clearInterval(this.sendLokiLogsInterval)
    }
    await this.sendLokiLogs()
    if (this.mustRenewTokenTimeout) {
      clearTimeout(this.mustRenewTokenTimeout)
    }
  }
}

const createTransport = async (opts) => {
  const lokiTransport = new LokiTransport(opts)
  return build(async (source) => {
    // eslint-disable-next-line no-restricted-syntax
    for await (const log of source) {
      await lokiTransport.addLokiLogs(log)
    }
  }, {
    close: async () => {
      await lokiTransport.end()
    },
  })
}

module.exports = createTransport
