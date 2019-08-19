const { spawn } = require('child_process')

const ProtocolHandler = require('../ProtocolHandler.class')
const TcpServer = require('./TcpServer')
const databaseService = require('../../services/database.service')

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

    this.tcpServer = null
    this.transactionId = 0
    this.agentConnected = false
    this.agentReady = false
    this.lastCompletedAt = {}
    this.ongoingReads = {}
    this.receivedLog = ''

    this.scanGroups = this.dataSource.scanGroups.map((scanGroup) => {
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
      // Initialize lastCompletedAt for every scanGroup
      const { dataSourceId, startTime } = this.dataSource
      const { engineConfig } = this.engine.configService.getConfig()
      const databasePath = `${engineConfig.caching.cacheFolder}/${dataSourceId}.db`
      this.configDatabase = await databaseService.createConfigDatabase(databasePath)

      const defaultLastCompletedAt = startTime ? new Date(startTime).getTime() : new Date().getTime()
      Object.keys(this.lastCompletedAt).forEach(async (key) => {
        let lastCompletedAt = await databaseService.getConfig(this.configDatabase, `lastCompletedAt-${key}`)
        lastCompletedAt = lastCompletedAt ? parseInt(lastCompletedAt, 10) : defaultLastCompletedAt
        this.logger.info(`Initializing lastCompletedAt for ${key} with ${lastCompletedAt}`)
        this.lastCompletedAt[key] = lastCompletedAt
      })

      // Launch Agent
      const { agentFilename, tcpPort, logLevel } = this.dataSource
      this.tcpServer = new TcpServer(tcpPort, this.logger, this.handleMessage.bind(this))
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
      this.logger.error(`HDA stderr: ${data}`)
    })

    this.child.on('close', (code) => {
      this.logger.info(`HDA agent exited with code ${code}`)
    })

    this.child.on('error', (error) => {
      this.logger.error(`Failed to start HDA agent: ${path}`, error)
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
          this.logger.silly(message)
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
    const { host, serverName } = this.dataSource
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
      Content: { Groups: this.scanGroups },
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
      this.logger.silly(`sendReadMessage not processed, agent ready: ${this.agentReady}`)
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
      this.logger.debug(`Sent at ${new Date().toISOString()}: ${messageString}`)
      this.tcpServer.sendMessage(messageString)
    } else {
      this.logger.debug(
        `send message not processed, TCP server: ${this.tcpServer}, agent connected: ${this.agentConnected}`,
      )
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

      switch (messageObject.Reply) {
        case 'Alive':
          this.agentConnected = true
          this.sendConnectMessage()
          break
        case 'Connect':
          this.logger.debug(`Agent connected to OPC HDA server: ${messageObject.Content.Connected}`)
          if (messageObject.Content.Connected) {
            this.sendInitializeMessage()
          } else {
            this.logger.error(
              `Unable to connect to ${this.dataSource.serverName} on ${this.dataSource.host}: ${
                messageObject.Content.Error
              }`,
            )
          }
          break
        case 'Initialize':
          this.agentReady = true
          this.logger.debug('received Initialize message')
          break
        case 'Read':
          if (messageObject.Content.Error) {
            this.ongoingReads[messageObject.Content.Group] = false
            this.logger.error(messageObject.Content.Error)
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

          this.logger.debug(`Received ${messageObject.Content.Points.length} values for ${messageObject.Content.Group}`)

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
          await databaseService.upsertConfig(
            this.configDatabase,
            `lastCompletedAt-${messageObject.Content.Group}`,
            this.lastCompletedAt[messageObject.Content.Group],
          )
          this.logger.debug(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${dateString}`)

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
      this.logger.error(error)
    }
  }
}

OPCHDA.schema = require('./schema')

module.exports = OPCHDA
