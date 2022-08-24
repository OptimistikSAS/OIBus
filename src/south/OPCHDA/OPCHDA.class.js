const { spawn } = require('child_process')

const ProtocolHandler = require('../ProtocolHandler.class')
const TcpServer = require('./TcpServer')
const DeferredPromise = require('./DeferredPromise')

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
    } = dataSource.OPCHDA

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

    this.canHandleHistory = true
    this.handlesPoints = true
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
      this.connected = true
      this.updateStatusDataStream({ 'Connected at': new Date().toISOString() })
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
   * historyQuery.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {Promise<number>} - The on scan promise: -1 if an error occurred, 0 otherwise
   */
  async historyQuery(scanMode, startTime, endTime) {
    this.historyRead$ = new DeferredPromise()
    this.sendReadMessage(scanMode, startTime, endTime)

    this.historyReadTimeout = setTimeout(() => {
      this.historyRead$.reject(new Error(`History query has not succeed in the requested readTimeout: ${this.readTimeout}`))
    }, this.readTimeout * 1000)
    await this.historyRead$.promise
    clearTimeout(this.historyReadTimeout)
    this.historyReadTimeout = null
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

    if (this.historyReadTimeout) {
      this.historyRead$.reject(new Error('History query cancelled because the connector is disconnecting'))
      clearTimeout(this.historyReadTimeout)
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
      this.handleHDAAgentLog(data)
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

  handleHDAAgentLog(data) {
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

  logMessage(log) {
    try {
      const parsedLog = JSON.parse(log)
      const message = `HDA Agent stdout: ${parsedLog.Message}`
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
        case 'trace':
          this.logger.trace(message)
          break
        default:
          this.logger.debug(message)
          break
      }
    } catch (error) {
      this.logger.error(error)
      this.logger.debug(`HDA Agent stdout error: ${log}`)
    }
  }

  generateTransactionId() {
    this.transactionId += 1
    return `${this.transactionId}`
  }

  sendConnectMessage() {
    const message = {
      Request: 'Connect',
      TransactionId: this.generateTransactionId(),
      Content: {
        host: this.host,
        serverName: this.serverName,
      },
    }
    this.sendTCPMessageToHDAAgent(message)
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
    this.sendTCPMessageToHDAAgent(message)
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
    this.sendTCPMessageToHDAAgent(message)
  }

  sendStopMessage() {
    const message = {
      Request: 'Stop',
      TransactionId: this.generateTransactionId(),
    }
    this.sendTCPMessageToHDAAgent(message)
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
  sendTCPMessageToHDAAgent(message) {
    if (this.tcpServer && this.agentConnected) {
      if (message.Request === 'Read') {
        this.ongoingReads[message.Content.Group] = true
      }
      const messageString = JSON.stringify(message)
      this.logger.trace(`Sent at ${new Date().toISOString()}: ${messageString}`)
      this.tcpServer.sendMessage(messageString)
      this.updateStatusDataStream({ 'Last message sent to HDA Agent at': new Date().toISOString() })
    } else {
      this.logger.debug(`sendTCPMessageToHDAAgent ignored, TCP server: ${this.tcpServer}, agent connected: ${this.agentConnected}`)
    }
  }

  /**
   * Handle a message received from the HDA Agent
   * @param {string} message - the message received from the HDA Agent
   * Message can be one of the following Alive, Connect, Initialize, Read, Disconnect, Stop
   * Others will be disregarded
   * @returns {Promise<void>} - return a promise that will resolve to void
   */
  async handleTcpHdaAgentMessages(message) {
    try {
      this.logger.trace(`Received message from HDA Agent: ${message}`)
      const messageObject = JSON.parse(message)

      switch (messageObject.Reply) {
        case 'Alive': // The HDA Agent is running
          this.agentConnected = true
          this.sendConnectMessage()
          break
        case 'Connect':
          // The HDA Agent answer on connection request. The Content.Connected variable tell if the HDA Agent is
          // connected to the HDA Server
          this.logger.info(`HDA Agent connected: ${messageObject.Content.Connected}`)
          if (messageObject.Content.Connected) {
            // Now that the HDA Agent is connected, the Agent can be initialized with the scan groups
            this.sendInitializeMessage()
          } else {
            this.logger.error(`Unable to connect to ${this.serverName} on ${this.host}: ${messageObject.Content.Error
            }, retrying in ${this.retryInterval}ms`)
            if (this.reconnectTimeout) {
              clearTimeout(this.reconnectTimeout)
            }
            this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), this.retryInterval)
          }
          break
        case 'Initialize': // The HDA Agent is connected and ready to read values
          this.logger.info('HDA Agent initialized')
          // resolve the connection promise
          this.connection$.resolve()
          break
        case 'Read': // Receive the values for the requested scan group (Content.Group) after a read request from historyQuery
          {
            if (messageObject.Content.Error) {
              this.ongoingReads[messageObject.Content.Group] = false
              if (messageObject.Content.Disconnected) {
                this.logger.error('Agent disconnected from OPC HDA server')
                this.connected = false
                if (this.reconnectTimeout) {
                  clearTimeout(this.reconnectTimeout)
                }
                this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), this.retryInterval)
              }
              this.historyRead$.reject(new Error(messageObject.Content.Error))
              return
            }

            if (messageObject.Content.Points === undefined) {
              this.ongoingReads[messageObject.Content.Group] = false
              this.historyRead$.reject(new Error(`Missing Points entry in response for ${messageObject.Content.Group}`))
              return
            }

            if (messageObject.Content.Points.length === 0) {
              this.ongoingReads[messageObject.Content.Group] = false
              this.logger.debug(`Empty Points response for ${messageObject.Content.Group}`)
              this.historyRead$.resolve()
              return
            }

            this.logger.trace(`Received ${messageObject.Content.Points.length} values for ${messageObject.Content.Group}`)

            const associatedScanGroup = this.scanGroups.find((scanGroup) => scanGroup.name === messageObject.Content.Group)

            const values = messageObject.Content.Points.filter((point) => {
              if (point.Timestamp != null && point.Value != null) {
                return true
              }
              this.logger.error(`Point: ${point.ItemId} is invalid: ${JSON.stringify(point)}`)
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

            this.lastCompletedAt[messageObject.Content.Group] = new Date(
              new Date(messageObject.Content.Points.slice(-1).pop().Timestamp).getTime() + 1,
            )
            await this.setConfig(
              `lastCompletedAt-${messageObject.Content.Group}`,
              this.lastCompletedAt[messageObject.Content.Group].toISOString(),
            )
            this.logger.trace(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${
              this.lastCompletedAt[messageObject.Content.Group].toISOString()}`)

            this.ongoingReads[messageObject.Content.Group] = false
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
          this.logger.info('HDA Agent disconnected')
          this.disconnection$.resolve()
          break
        default:
          this.logger.warn(`Unknown HDA Agent reply: ${messageObject.Reply}`)
      }
    } catch (error) {
      this.logger.error(`Can't handle message ${message}. Error: ${error.stack}`)
    }
  }
}

module.exports = OPCHDA
