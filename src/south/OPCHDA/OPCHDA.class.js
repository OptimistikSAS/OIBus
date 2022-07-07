// eslint-disable-next-line max-classes-per-file
const { spawn } = require('child_process')

const ProtocolHandler = require('../ProtocolHandler.class')
const TcpServer = require('./TcpServer')

/**
 * Class used to resolve a promise from another variable
 * It is used in OPCHDA to resolve the connection and disconnection when the
 * HDA Agent sends the associated messages
 */
class DeferredPromise {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = resolve
    })
  }
}

// Time to wait before closing the connection by timeout and killing the Agent process
const DISCONNECTION_TIMEOUT = 10000

/**
 * Class OPCHDA.
 */
class OPCHDA extends ProtocolHandler {
  static category = 'IoT'

  /**
   * Constructor for OPCHDA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {BaseEngine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, { supportListen: false, supportLastPoint: false, supportFile: false, supportHistory: true })

    const { maxReadInterval, readIntervalDelay, maxReturnValues } = dataSource.OPCHDA

    this.tcpServer = null
    this.transactionId = 0
    this.agentConnected = false
    this.receivedLog = ''
    this.reconnectTimeout = null
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.maxReturnValues = maxReturnValues

    this.connection$ = null
    this.disconnection$ = null

    this.canHandleHistory = true
    this.handlesPoints = true

    this.disconnectionTimeout = null
  }

  /**
   * Connect to the HDA Agent (not the OPC server yet).
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    if (process.platform === 'win32') {
      await super.connect()
      await this.runTcpServer()
      await this.connection$.promise
    } else {
      this.logger.error(`OIBus OPCHDA Agent only supported on Windows: ${process.platform}`)
    }
  }

  /**
   * Starts a TCP Server on the given tcpPort to listen to the HDA Agent TCP Client
   * @returns {Promise<unknown>} The promise resolved when the TCP server is running
   */
  async runTcpServer() {
    return new Promise((resolve, reject) => {
      try {
        const { agentFilename, tcpPort, logLevel } = this.dataSource.OPCHDA
        this.tcpServer = new TcpServer(tcpPort, this.handleMessage.bind(this), this.logger)

        this.tcpServer.start(() => {
          this.launchAgent(agentFilename, tcpPort, logLevel)
          this.connection$ = new DeferredPromise()
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * historyQuery.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {Promise<number>} - The on scan promise: -1 if an error occurred, 0 otherwise
   */
  async historyQuery(scanMode, startTime, endTime) {
    this.sendReadMessage(scanMode, startTime, endTime)
    // Wait until we receive the response
    while (this.ongoingReads[scanMode]) {
      // eslint-disable-next-line no-await-in-loop
      await this.delay(100)
    }
    return 0
  }

  /**
   * Close the connection and reinitialize the connector.
   * @return {void}
   */
  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.agentConnected) { // TCP connection with the HDA Agent was previously established
      // In this case, we ask the HDA Agent to stop and disconnect gracefully
      this.sendStopMessage()
      await this.disconnection$.promise
    }

    if (this.disconnectionTimeout) {
      clearTimeout(this.disconnectionTimeout)
    }

    // Child process HDA Agent is now ready to be killed
    this.child.kill()
    this.child = null

    if (this.tcpServer) {
      this.tcpServer.stop()
    }

    this.tcpServer = null

    this.agentConnected = false

    this.statusData['Connected at'] = 'Not connected'
    this.updateStatusDataStream()
    await super.disconnect()
  }

  /**
   * Launch agent application.
   * @param {string} path - The path to the agent executable
   * @param {number} port - The port to send as command line argument
   * @param {string} logLevel - The logging level for the Agent
   * @returns {void}
   */
  launchAgent(path, port, logLevel) {
    this.logger.info(`Launching ${path} with the arguments: listen -p ${port} -l ${logLevel} -x none`)
    this.child = spawn(path, ['listen', `-p ${port}`, `-l ${logLevel}`, '-x none'])

    this.child.stdout.on('data', (data) => {
      this.handleAgentLog(data)
    })

    this.child.stderr.on('data', (data) => {
      this.logger.error(`HDA stderr: ${data}`)
    })

    this.child.on('close', (code) => {
      this.logger.info(`HDA agent exited with code ${code}`)
    })

    this.child.on('error', (error) => {
      this.logger.error(`Failed to start HDA agent: ${error.message}`)
    })
  }

  handleAgentLog(data) {
    const content = data.toString()
    const logs = []

    if (content.includes('\n')) {
      const messageParts = content.split('\r\n')

      messageParts.forEach(async (messagePart, index) => {
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

    logs.forEach(async (log) => {
      if (log.length > 0) {
        this.logMessage(log.trim())
      }
    })
  }

  /* eslint-disable-next-line class-methods-use-this */
  logMessage(log) {
    try {
      const parsedLog = JSON.parse(log)
      const message = `Agent stdout: ${parsedLog.Message}`
      switch (parsedLog.Level) {
        case 'error':
          this.logger.error(message)
          break
        case 'info':
          this.logger.info(message)
          break
        case 'debug':
          this.logger.debug(message)
          break
        case 'silly':
          this.logger.trace(message)
          break
        default:
          this.logger.debug(message)
          break
      }
    } catch (error) {
      this.logger.error(error)
      this.logger.debug(`Agent stdout error: ${log}`)
    }
  }

  generateTransactionId() {
    this.transactionId += 1
    return `${this.transactionId}`
  }

  sendConnectMessage() {
    const { host, serverName } = this.dataSource.OPCHDA
    const message = {
      Request: 'Connect',
      TransactionId: this.generateTransactionId(),
      Content: {
        host,
        serverName,
      },
    }
    this.sendMessage(message)
  }

  sendInitializeMessage() {
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
    this.sendMessage(message)
  }

  sendReadMessage(scanMode, startTime, endTime) {
    const message = {
      Request: 'Read',
      TransactionId: this.generateTransactionId(),
      Content: {
        Group: scanMode,
        StartTime: startTime.getTime(),
        EndTime: endTime.getTime(),
      },
    }
    this.sendMessage(message)
  }

  sendStopMessage() {
    const message = {
      Request: 'Stop',
      TransactionId: this.generateTransactionId(),
    }
    this.sendMessage(message)
    this.disconnection$ = new DeferredPromise()
    this.disconnectionTimeout = setTimeout(() => {
      this.disconnection$.resolve()
    }, DISCONNECTION_TIMEOUT)
  }

  /**
   * Send a message to the HDA Agent
   * @param {object} message - the message to send
   * @return {void}
   */
  sendMessage(message) {
    if (this.tcpServer && this.agentConnected) {
      if (message.Request === 'Read') {
        this.ongoingReads[message.Content.Group] = true
      }
      const messageString = JSON.stringify(message)
      this.logger.trace(`Sent at ${new Date().toISOString()}: ${messageString}`)
      this.tcpServer.sendMessage(messageString)
      this.statusData['Last message sent at'] = new Date().toISOString()
      this.updateStatusDataStream()
    } else {
      this.logger.debug(`sendMessage ignored, TCP server: ${this.tcpServer}, agent connected: ${this.agentConnected}`)
    }
  }

  /**
   * Handle a message sent by the HDA Agent
   * @param {string} message - the message sent by the HDA Agent
   * Message can be one of the following Alive, Connect, Initialize, Read, Disconnect, Stop
   * Others will be disregarded
   * @returns {Promise<void>} - return a promise that will resolve to void
   */
  async handleMessage(message) {
    try {
      this.logger.trace(`Received: ${message}`)

      const messageObject = JSON.parse(message)
      let dateString
      const { host, serverName, retryInterval } = this.dataSource.OPCHDA

      switch (messageObject.Reply) {
        case 'Alive': // The HDA Agent is running
          this.agentConnected = true
          this.sendConnectMessage()
          break
        case 'Connect':
          // The HDA Agent answer on connection request. The Content.Connected variable tell if the HDA Agent is connected to the HDA Server
          this.logger.info(`HDA Agent connected: ${messageObject.Content.Connected}`)
          if (messageObject.Content.Connected) {
            // Now that the HDA Agent is connected, the Agent can be initialized with the scan groups
            this.sendInitializeMessage()
          } else {
            this.logger.error(`Unable to connect to ${serverName} on ${host}: ${messageObject.Content.Error}, retrying in ${retryInterval}ms`)
            if (this.reconnectTimeout) {
              clearTimeout(this.reconnectTimeout)
            }
            this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), retryInterval)
          }
          break
        case 'Initialize': // The HDA Agent is connected and ready to read values
          this.connected = true
          this.statusData['Connected at'] = new Date().toISOString()
          this.updateStatusDataStream()
          // resolve the connection promise
          this.connection$.resolve()
          this.logger.info(`HDA Agent initialized: ${this.connected}`)
          break
        case 'Read': // Receive the values for the requested scan group (Content.Group) after a read request from historyQuery
          {
            if (messageObject.Content.Error) {
              this.ongoingReads[messageObject.Content.Group] = false
              this.logger.error(messageObject.Content.Error)
              if (messageObject.Content.Disconnected) {
                this.logger.error('Agent disconnected from OPC HDA server')
                this.connected = false
                if (this.reconnectTimeout) {
                  clearTimeout(this.reconnectTimeout)
                }
                this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), retryInterval)
              }
              return
            }

            if (messageObject.Content.Points === undefined) {
              this.ongoingReads[messageObject.Content.Group] = false
              this.logger.error(`Missing Points entry in response for ${messageObject.Content.Group}`)
              return
            }

            if (messageObject.Content.Points.length === 0) {
              this.ongoingReads[messageObject.Content.Group] = false
              this.logger.debug(`Empty Points response for ${messageObject.Content.Group}`)
              return
            }

            this.logger.trace(`Received ${messageObject.Content.Points.length} values for ${messageObject.Content.Group}`)

            const associatedScanGroup = this.scanGroups.find((scanGroup) => scanGroup.name === messageObject.Content.Group)
            // eslint-disable-next-line no-case-declarations
            const values = messageObject.Content.Points.filter((point) => {
              if (point.Timestamp != null && point.Value != null) {
                return true
              }
              this.logger.error(`point: ${point.ItemId} is invalid:${JSON.stringify(point)}`)
              return false
            }).map((point) => {
              const associatedPointId = associatedScanGroup?.points
                .find((scanGroupPoint) => scanGroupPoint.nodeId === point.ItemId)?.pointId || point.ItemId
              return {
                pointId: associatedPointId,
                timestamp: new Date(point.Timestamp).toISOString(),
                data: { value: point.Value.toString(), quality: JSON.stringify(point.Quality) },
              }
            })
            this.addValues(values)

            dateString = messageObject.Content.Points.slice(-1).pop().Timestamp
            this.lastCompletedAt[messageObject.Content.Group] = new Date(new Date(dateString).getTime() + 1)
            await this.setConfig(
              `lastCompletedAt-${messageObject.Content.Group}`,
              this.lastCompletedAt[messageObject.Content.Group].toISOString(),
            )
            this.logger.trace(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${dateString}`)

            this.ongoingReads[messageObject.Content.Group] = false
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
          this.logger.info('HDA Agent disconnected')
          this.disconnection$.resolve()
          break
        default:
          this.logger.warn(`unknown messageObject.Reply ${messageObject.Reply}`)
      }
    } catch (error) {
      this.logger.error(`can't handle message ${message} ${error.stack}`)
    }
  }
}

module.exports = OPCHDA
