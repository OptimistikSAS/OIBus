const { spawn } = require('child_process')

const ProtocolHandler = require('../ProtocolHandler.class')
const TcpServer = require('./TcpServer')
const Logger = require('../../engine/Logger.class')

/**
 * Class OPCHDA.
 */
class OPCHDA extends ProtocolHandler {
  /**
   * Constructor for OPCHDA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const { logParameters } = this.dataSource.OPCHDA

    this.agentLogger = new Logger()
    this.agentLogger.changeParameters(this.engineConfig.logParameters, logParameters, this.constructor.name)

    this.tcpServer = null
    this.transactionId = 0
    this.agentConnected = false
    this.agentReady = false
    this.lastCompletedAt = {}
    this.ongoingReads = {}
    this.receivedLog = ''
    this.reconnectTimeout = null

    this.scanGroups = this.dataSource.OPCHDA.scanGroups.map((scanGroup) => {
      const points = this.dataSource.points
        .filter((point) => point.scanMode === scanGroup.scanMode)
        .map((point) => point.pointId)
      this.lastCompletedAt[scanGroup.scanMode] = new Date().getTime()
      this.ongoingReads[scanGroup.scanMode] = false
      return {
        name: scanGroup.scanMode,
        ...scanGroup,
        points,
      }
    })
  }

  /**
   * Connect.
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    if (process.platform === 'win32') {
      await super.connect()
      // Initialize lastCompletedAt for every scanGroup
      // "startTime" is currently a "hidden" parameter of oibus.json
      const { startTime } = this.dataSource
      const defaultLastCompletedAt = startTime ? new Date(startTime).getTime() : new Date().getTime()

      Object.keys(this.lastCompletedAt).forEach(async (key) => {
        let lastCompletedAt = await this.getConfigDb(`lastCompletedAt-${key}`)
        lastCompletedAt = lastCompletedAt ? parseInt(lastCompletedAt, 10) : defaultLastCompletedAt
        this.logger.info(`Initializing lastCompletedAt for ${key} with ${lastCompletedAt}`)
        this.lastCompletedAt[key] = lastCompletedAt
      })

      // Launch Agent
      const { agentFilename, tcpPort, logLevel } = this.dataSource.OPCHDA
      this.tcpServer = new TcpServer(tcpPort, this.handleMessage.bind(this), this.logger)
      this.tcpServer.start(() => {
        this.launchAgent(agentFilename, tcpPort, logLevel)
      })
    } else {
      this.logger.error(`OIBusOPCHDA agent only supported on Windows: ${process.platform}`)
    }
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  onScan(scanMode) {
    this.sendReadMessage(scanMode)
  }

  /**
   * Close the connection.
   * @return {void}
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    this.sendStopMessage()
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
      this.agentLogger.error(`HDA stderr: ${data}`)
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
          this.agentLogger.error(message)
          break
        case 'info':
          this.agentLogger.info(message)
          break
        case 'debug':
          this.agentLogger.debug(message)
          break
        case 'silly':
          this.agentLogger.silly(message)
          break
        default:
          this.agentLogger.debug(message)
          break
      }
    } catch (error) {
      this.logger.error(error)
      this.agentLogger.debug(`Agent stdout error: ${log}`)
    }
  }

  generateTransactionId() {
    this.transactionId += 1
    return `${this.transactionId}`
  }

  sendConnectMessage() {
    this.reconnectTimeout = null
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
    const { maxReturnValues, maxReadInterval } = this.dataSource.OPCHDA
    const message = {
      Request: 'Initialize',
      TransactionId: this.generateTransactionId(),
      Content: {
        Groups: this.scanGroups,
        MaxReturnValues: maxReturnValues,
        MaxReadInterval: maxReadInterval,
      },
    }
    this.sendMessage(message)
  }

  sendReadMessage(scanMode) {
    if (!this.ongoingReads[scanMode] && this.agentReady) {
      const message = {
        Request: 'Read',
        TransactionId: this.generateTransactionId(),
        Content: {
          Group: scanMode,
          StartTime: this.lastCompletedAt[scanMode],
        },
      }
      this.sendMessage(message)
    } else {
      this.logger.silly(`sendReadMessage(${scanMode}) skipped, agent ready: ${this.agentReady}/ongoing ${this.ongoingReads[scanMode]}`)
    }
  }

  sendStopMessage() {
    const message = {
      Request: 'Stop',
      TransactionId: this.generateTransactionId(),
    }
    this.sendMessage(message)
  }

  sendMessage(message) {
    if (this.tcpServer && this.agentConnected) {
      if (message.Request === 'Read') {
        this.ongoingReads[message.Content.Group] = true
      }

      const messageString = JSON.stringify(message)
      this.logger.silly(`Sent at ${new Date().toISOString()}: ${messageString}`)
      this.tcpServer.sendMessage(messageString)
    } else {
      this.logger.debug(`sendMessage ignored, TCP server: ${this.tcpServer}, agent connected: ${this.agentConnected}`)
    }
  }

  /**
   * Handle a message sent by the OPCHDA agent
   * @param {string} message - the message sent by the OPCHDA agent
   * Message can be one of the following Alive, Connect, Initialize, Read, Disconnect, Stop
   * Others will be disregarded
   * @returns {Promise<void>} - return a promise that will resolve to void
   */
  async handleMessage(message) {
    try {
      this.logger.silly(`Received: ${message}`)

      const messageObject = JSON.parse(message)
      let dateString
      const { host, serverName, retryInterval } = this.dataSource.OPCHDA

      switch (messageObject.Reply) {
        case 'Alive':
          this.agentConnected = true
          this.sendConnectMessage()
          break
        case 'Connect':
          this.logger.info(`HDAAgent connected: ${messageObject.Content.Connected}`)
          if (messageObject.Content.Connected) {
            this.sendInitializeMessage()
          } else {
            this.logger.error(`Unable to connect to ${serverName} on ${host}: ${messageObject.Content.Error}, retrying in ${retryInterval}ms`)
            this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), retryInterval)
          }
          break
        case 'Initialize':
          this.agentReady = true
          this.logger.info(`HDAAgent initialized: ${this.agentReady}`)
          break
        case 'Read':
          if (messageObject.Content.Error) {
            this.ongoingReads[messageObject.Content.Group] = false
            this.logger.error(messageObject.Content.Error)

            if (messageObject.Content.Disconnected) {
              this.logger.error('Agent disconnected from OPC HDA server')
              this.agentReady = false
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

          this.logger.silly(`Received ${messageObject.Content.Points.length} values for ${messageObject.Content.Group}`)

          // eslint-disable-next-line no-case-declarations
          const values = messageObject.Content.Points.map((point) => {
            if (point.Timestamp != null && point.Value != null) {
              return {
                pointId: point.ItemId,
                timestamp: new Date(point.Timestamp).toISOString(),
                data: { value: point.Value.toString(), quality: JSON.stringify(point.Quality) },
              }
            }
            this.logger.error(`point: ${point.ItemId} is invalid:${JSON.stringify(point)}`)
            return {}
          })
          this.addValues(values)

          dateString = messageObject.Content.Points.slice(-1).pop().Timestamp
          this.lastCompletedAt[messageObject.Content.Group] = new Date(dateString).getTime() + 1
          await this.upsertConfigDb(
            `lastCompletedAt-${messageObject.Content.Group}`,
            this.lastCompletedAt[messageObject.Content.Group],
          )
          this.logger.silly(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${dateString}`)

          this.ongoingReads[messageObject.Content.Group] = false
          break
        case 'Disconnect':
          this.agentReady = false
          this.agentConnected = false
          break
        case 'Stop':
          this.tcpServer.stop()
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
