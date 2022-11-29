import { spawn } from 'node:child_process'

import SouthConnector from '../south-connector.js'
import TcpServer from './tcp-server.js'
import DeferredPromise from '../../service/deferred-promise.js'

// Time to wait before closing the connection by timeout and killing the HDA Agent process
const DISCONNECTION_TIMEOUT = 10000

/**
 * Class SouthOPCHDA - Run a HDA agent to connect to an OPCHDA server.
 * This connector communicates with the Agent through a TCP connection thanks to the TCP server created on OIBus
 * and associated to this connector
 */
export default class SouthOPCHDA extends SouthConnector {
  static category = 'IoT'

  /**
   * Constructor for SouthOPCHDA
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      {
        supportListen: false,
        supportLastPoint: false,
        supportFile: false,
        supportHistory: true,
      },
    )
    this.canHandleHistory = true
    this.handlesPoints = true

    const {
      agentFilename,
      tcpPort,
      logLevel,
      host,
      serverName,
      retryInterval,
      maxReadInterval,
      readIntervalDelay,
      maxReturnValues,
      readTimeout,
    } = configuration.settings

    this.agentFilename = agentFilename
    this.tcpPort = tcpPort
    this.logLevel = logLevel
    this.host = host
    this.serverName = serverName
    this.retryInterval = retryInterval
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.maxReturnValues = maxReturnValues
    this.readTimeout = readTimeout

    // Initialized at connection
    this.tcpServer = null
    this.transactionId = 0
    this.agentConnected = false
    this.receivedLog = ''
    this.reconnectTimeout = null
    this.historyReadTimeout = null
    this.disconnectionTimeout = null

    this.connection$ = null
    this.historyRead$ = null
    this.disconnection$ = null
  }

  /**
   * Connect to the HDA Agent (not the OPC server yet).
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    if (process.platform === 'win32') {
      await this.runTcpServer()
      await this.connection$.promise
      await super.connect()
    } else {
      this.logger.error(`OIBus OPCHDA Agent only supported on Windows: ${process.platform}.`)
    }
  }

  /**
   * Starts a TCP Server on the given tcpPort to listen to the HDA Agent TCP Client
   * @returns {Promise<void>} - The result promise
   */
  async runTcpServer() {
    return new Promise((resolve, reject) => {
      try {
        this.tcpServer = new TcpServer(this.tcpPort, this.handleTcpHdaAgentMessages.bind(this), this.logger)
        this.tcpServer.start(() => {
          this.launchAgent(this.agentFilename, this.tcpPort, this.logLevel)
          this.connection$ = new DeferredPromise()
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<void>} - The result promise
   */
  async historyQuery(scanMode, startTime, endTime) {
    this.historyRead$ = new DeferredPromise()
    await this.sendReadMessage(scanMode, startTime, endTime)

    this.historyReadTimeout = setTimeout(() => {
      this.historyRead$.reject(new Error(`History query has not succeeded in the requested readTimeout: ${this.readTimeout}s.`))
    }, this.readTimeout * 1000)
    await this.historyRead$.promise
    clearTimeout(this.historyReadTimeout)
    this.historyReadTimeout = null
  }

  /**
   * Close the connection and reinitialize the connector.
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.historyReadTimeout) {
      clearTimeout(this.historyReadTimeout)
    }

    if (this.agentConnected) { // TCP connection with the HDA Agent was previously established
      // In this case, we ask the HDA Agent to stop and disconnect gracefully
      await this.sendStopMessage()
      await this.disconnection$.promise
    }

    if (this.disconnectionTimeout) {
      clearTimeout(this.disconnectionTimeout)
    }

    if (this.child) {
      // Child process HDA Agent is now ready to be killed
      this.child.kill()
      this.child = null
    }

    if (this.tcpServer) {
      this.tcpServer.stop()
    }
    this.tcpServer = null

    this.agentConnected = false
    await super.disconnect()
  }

  /**
   * Launch HDA agent application.
   * @param {String} path - The path to the agent executable
   * @param {Number} port - The port to send as command line argument
   * @param {String} logLevel - The logging level for the Agent
   * @returns {void}
   */
  launchAgent(path, port, logLevel) {
    this.logger.info(`Launching ${path} with the arguments: listen -p ${port} -l ${logLevel} -x none`)
    this.child = spawn(path, ['listen', `-p ${port}`, `-l ${logLevel}`, '-x none'])

    this.child.stdout.on('data', (data) => {
      this.handleHdaAgentLog(data)
    })

    this.child.stderr.on('data', (data) => {
      this.logger.error(`HDA agent stderr: "${data}".`)
    })

    this.child.on('close', (code) => {
      this.logger.info(`HDA agent exited with code ${code}.`)
    })

    this.child.on('error', (error) => {
      this.logger.error(`Failed to start HDA agent: "${error.message}".`)
    })
  }

  /**
   * Parse messages received from the HDA agent and send them to the logger
   * @param {String} data - The data to parse
   * @return {void}
   */
  handleHdaAgentLog(data) {
    const content = data.toString()
    const logs = []

    if (content.includes('\n')) {
      const messageParts = content.split('\r\n')

      messageParts.forEach((messagePart, index) => {
        if (index === 0) {
          this.receivedLog += messagePart
          logs.push(this.receivedLog)
          this.receivedLog = ''
        } else if (index === messageParts.length - 1) {
          this.receivedLog = messagePart
        } else {
          logs.push(messagePart)
        }
      })
    } else {
      this.receivedLog += content
    }

    logs.forEach((log) => {
      if (log.length > 0) {
        this.logMessage(log.trim())
      }
    })
  }

  /**
   * Send a HDA agent log to the logger
   * @param {String} log - The log to send to the logger
   * @return {void}
   */
  logMessage(log) {
    try {
      const parsedLog = JSON.parse(log)
      const message = `HDA Agent stdout: ${parsedLog.Message}`
      switch (parsedLog.Level) {
        case 'error':
          this.logger.error(message)
          break
        case 'warn':
          this.logger.warn(message)
          break
        case 'info':
          this.logger.info(message)
          break
        case 'debug':
          this.logger.debug(message)
          break
        case 'trace':
          this.logger.trace(message)
          break
        default:
          this.logger.debug(message)
          break
      }
    } catch (error) {
      this.logger.error(`The error "${error}" occurred when parsing HDA Agent log "${log}".`)
    }
  }

  /**
   * Generate a transaction ID for each TCP message sent to the TCP Server
   * @returns {String} - The transaction ID
   */
  generateTransactionId() {
    this.transactionId += 1
    return `${this.transactionId}`
  }

  /**
   * Send a TCP connection message to the HDA Agent to connect to the OPCHDA server
   * @returns {Promise<void>} - The result promise
   */
  async sendConnectMessage() {
    const message = {
      Request: 'Connect',
      TransactionId: this.generateTransactionId(),
      Content: {
        host: this.host,
        serverName: this.serverName,
      },
    }
    await this.sendTCPMessageToHdaAgent(message)
  }

  /**
   * Send a TCP initialization message to the HDA agent to set up the OPCHDA communication
   * @returns {Promise<void>} - The result promise
   */
  async sendInitializeMessage() {
    const message = {
      Request: 'Initialize',
      TransactionId: this.generateTransactionId(),
      Content: {
        Groups: this.scanGroups.map((scanGroup) => ({
          name: scanGroup.name,
          aggregate: scanGroup.aggregate,
          resampling: scanGroup.resampling,
          scanMode: scanGroup.scanMode,
          points: scanGroup.points.map((point) => point.nodeId),
        })),
        MaxReturnValues: this.maxReturnValues,
        MaxReadInterval: this.maxReadInterval,
        ReadIntervalDelay: this.readIntervalDelay,
      },
    }
    await this.sendTCPMessageToHdaAgent(message)
  }

  /**
   * Send a TCP read message to the HDA agent to retrieve from the OPCHDA Server data associated to a scan group
   * previously set up in the initialization phase
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<void>} - The result promise
   */
  async sendReadMessage(scanMode, startTime, endTime) {
    const message = {
      Request: 'Read',
      TransactionId: this.generateTransactionId(),
      Content: {
        Group: scanMode,
        StartTime: startTime.getTime(),
        EndTime: endTime.getTime(),
      },
    }
    await this.sendTCPMessageToHdaAgent(message)
  }

  /**
   * Send a TCP stop message to the HDA agent to stop the HDA agent
   * @returns {Promise<void>} - The result promise
   */
  async sendStopMessage() {
    const message = {
      Request: 'Stop',
      TransactionId: this.generateTransactionId(),
    }
    await this.sendTCPMessageToHdaAgent(message)
    this.disconnection$ = new DeferredPromise()
    this.disconnectionTimeout = setTimeout(() => {
      this.disconnection$.resolve()
    }, DISCONNECTION_TIMEOUT)
  }

  /**
   * Send a TCP message to the HDA Agent
   * @param {Object} message - The message to send
   * @returns {Promise<void>} - The result promise
   */
  async sendTCPMessageToHdaAgent(message) {
    if (this.tcpServer && this.agentConnected) {
      const messageString = JSON.stringify(message)
      this.logger.trace(`TCP message sent to the HDA agent: "${messageString}"`)
      this.tcpServer.sendMessage(messageString)
      this.statusService.updateStatusDataStream({ 'Last message sent to the HDA Agent at': new Date().toISOString() })
    } else {
      this.logger.error('The message has not been sent. Reinitializing the HDA agent.')
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
      }
      await this.disconnect()
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
    }
  }

  /**
   * Handle a message received from the HDA Agent
   * @param {String} message - the message received from the HDA Agent
   * Message can be one of the following Alive, Connect, Initialize, Read, Disconnect, Stop
   * Others will be disregarded
   * @returns {Promise<void>} - The result promise
   */
  async handleTcpHdaAgentMessages(message) {
    try {
      this.logger.trace(`Received message from HDA Agent: "${message}".`)
      const messageObject = JSON.parse(message)

      switch (messageObject.Reply) {
        case 'Alive': // The HDA Agent is running
          this.agentConnected = true
          await this.sendConnectMessage()
          break
        case 'Connect':
          // The HDA Agent answers on "sendConnectMessage". The Content.Connected variable tells if the HDA Agent is
          // connected to the HDA Server
          this.logger.info(`HDA Agent connected: ${messageObject.Content.Connected}.`)
          if (messageObject.Content.Connected) {
            // Now that the HDA Agent is connected, the Agent can be initialized with the scan groups
            await this.sendInitializeMessage()
          } else {
            this.logger.error(`Unable to connect to "${this.serverName}" on ${this.host}: ${messageObject.Content.Error
            }, retrying in ${this.retryInterval}ms`)
            await this.disconnect()
            this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
          }
          break
        case 'Initialize': // The HDA Agent is connected and ready to read values
          this.logger.info('HDA Agent initialized.')
          // resolve the connection promise to resolve the connect method
          this.connection$.resolve()
          break
        case 'Read': // Receive the values for the requested scan group (Content.Group) after a read request from historyQuery
          {
            if (messageObject.Content.Error) {
              if (messageObject.Content.Disconnected) {
                this.logger.error('Agent disconnected from OPC HDA server.')
                await this.disconnect()
                this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), this.retryInterval)
              }
              this.historyRead$.reject(new Error(messageObject.Content.Error))
              return
            }

            if (messageObject.Content.Points === undefined) {
              this.historyRead$.reject(new Error(`Missing points entry in response for scan mode "${messageObject.Content.Group}".`))
              return
            }

            if (messageObject.Content.Points.length === 0) {
              this.logger.debug(`Empty points response for scan mode "${messageObject.Content.Group}".`)
              this.historyRead$.resolve()
              return
            }

            this.logger.trace(`Received ${messageObject.Content.Points.length} values for scan mode "${messageObject.Content.Group}".`)

            const associatedScanGroup = this.scanGroups.find((scanGroup) => scanGroup.name === messageObject.Content.Group)

            if (!associatedScanGroup) {
              this.historyRead$.reject(new Error(`Scan group "${messageObject.Content.Group}" not found.`))
              return
            }

            const values = messageObject.Content.Points.filter((point) => {
              if (point.Timestamp !== undefined && point.Value !== undefined) {
                return true
              }
              this.logger.error(`Point: "${point.ItemId}" is invalid: ${JSON.stringify(point)}`)
              return false
            }).map((point) => {
              const associatedPointId = associatedScanGroup.points
                .find((scanGroupPoint) => scanGroupPoint.nodeId === point.ItemId)?.pointId || point.ItemId
              return {
                pointId: associatedPointId,
                timestamp: new Date(point.Timestamp).toISOString(),
                data: { value: point.Value.toString(), quality: JSON.stringify(point.Quality) },
              }
            })
            await this.addValues(values)

            this.lastCompletedAt[messageObject.Content.Group] = new Date(
              new Date(values.slice(-1).pop().timestamp).getTime() + 1,
            )
            this.setConfig(
              `lastCompletedAt-${messageObject.Content.Group}`,
              this.lastCompletedAt[messageObject.Content.Group].toISOString(),
            )
            this.logger.trace(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${
              this.lastCompletedAt[messageObject.Content.Group].toISOString()}`)
            this.historyRead$.resolve()
          }
          break
        case 'Stop': // The HDA Agent has received the stop message and the disconnection promise can be resolved
          this.logger.info('HDA Agent stopping...')
          if (!this.connected) {
            // If the connection with the OPC HDA server could not be established,
            // The promise can be resolved right away since we won't receive the disconnect message
            this.disconnection$.resolve()
          }
          break
        case 'Disconnect': // The HDA Agent is disconnected from the server
          this.logger.info('HDA Agent disconnected.')
          this.disconnection$.resolve()
          break
        default:
          this.logger.error(`Unknown HDA Agent reply: "${messageObject.Reply}".`)
      }
    } catch (error) {
      this.logger.error(`Can't handle message "${message}".`)
    }
  }
}
