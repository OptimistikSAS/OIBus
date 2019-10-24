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

    this.agentLogSource = 'OIBusOPCHDA'

    this.tcpServer = null
    this.transactionId = 0
    this.agentConnected = false
    this.agentReady = false
    this.lastCompletedAt = {}
    this.ongoingReads = {}
    this.receivedLog = ''
    this.reconnectTimeout = null

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
        logger.info(`Initializing lastCompletedAt for ${key} with ${lastCompletedAt}`, this.logSource)
        this.lastCompletedAt[key] = lastCompletedAt
      })

      // Launch Agent
      const { agentFilename, tcpPort, logLevel } = this.dataSource.OPCHDA
      this.tcpServer = new TcpServer(tcpPort, this.handleMessage.bind(this), this.logSource)
      this.tcpServer.start(() => {
        this.launchAgent(agentFilename, tcpPort, logLevel)
      })
    } else {
      logger.error(`OIBusOPCHDA agent only supported on Windows: ${process.platform}`, this.logSource)
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
    logger.info(`Launching ${path} with the arguments: listen -p ${port} -l ${logLevel} -x none`, this.logSource)
    this.child = spawn(path, ['listen', `-p ${port}`, `-l ${logLevel}`, '-x none'])

    this.child.stdout.on('data', (data) => {
      this.handleAgentLog(data)
    })

    this.child.stderr.on('data', (data) => {
      logger.error(`HDA stderr: ${data}`, this.agentLogSource)
    })

    this.child.on('close', (code) => {
      logger.info(`HDA agent exited with code ${code}`, this.logSource)
    })

    this.child.on('error', (error) => {
      logger.error(`Failed to start HDA agent: ${path}`, this.logSource)
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
          logger.error(message, this.agentLogSource)
          break
        case 'info':
          logger.info(message, this.agentLogSource)
          break
        case 'debug':
          logger.debug(message, this.agentLogSource)
          break
        case 'silly':
          logger.silly(message, this.agentLogSource)
          break
        default:
          logger.debug(message, this.agentLogSource)
          break
      }
    } catch (error) {
      logger.error(error, this.logSource)
      logger.debug(`Agent stdout error: ${log}`, this.logSource)
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
      logger.silly(`sendReadMessage not processed, agent ready: ${this.agentReady}`, this.logSource)
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
      logger.debug(`Sent at ${new Date().toISOString()}: ${messageString}`, this.logSource)
      this.tcpServer.sendMessage(messageString)
    } else {
      logger.debug(
        `send message not processed, TCP server: ${this.tcpServer}, agent connected: ${this.agentConnected}`,
        this.logSource,
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
      logger.silly(`Received: ${message}`, this.logSource)

      const messageObject = JSON.parse(message)
      let dateString
      const { host, serverName, retryInterval } = this.dataSource.OPCHDA

      switch (messageObject.Reply) {
        case 'Alive':
          this.agentConnected = true
          this.sendConnectMessage()
          break
        case 'Connect':
          logger.debug(`Agent connected to OPC HDA server: ${messageObject.Content.Connected}`, this.logSource)
          if (messageObject.Content.Connected) {
            this.sendInitializeMessage()
          } else {
            logger.error(
              `Unable to connect to ${serverName} on ${host}: ${messageObject.Content.Error}`,
              this.logSource,
            )
            this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), retryInterval)
          }
          break
        case 'Initialize':
          this.agentReady = true
          logger.debug('received Initialize message', this.logSource)
          break
        case 'Read':
          if (messageObject.Content.Error) {
            this.ongoingReads[messageObject.Content.Group] = false
            logger.error(messageObject.Content.Error, this.logSource)
            return
          }

          if (messageObject.Content.Points === undefined) {
            this.ongoingReads[messageObject.Content.Group] = false
            logger.error(`Missing Points entry in response for ${messageObject.Content.Group}`, this.logSource)
            return
          }

          if (messageObject.Content.Points.length === 0) {
            this.ongoingReads[messageObject.Content.Group] = false
            logger.debug(`Empty Points response for ${messageObject.Content.Group}`, this.logSource)
            return
          }

          logger.debug(`Received ${messageObject.Content.Points.length} values for ${messageObject.Content.Group}`, this.logSource)

          // eslint-disable-next-line no-case-declarations
          const values = messageObject.Content.Points.map((point) => {
            if (point.Timestamp != null && point.Value != null) {
              return {
                pointId: point.ItemId,
                timestamp: new Date(point.Timestamp).toISOString(),
                data: { value: point.Value.toString(), quality: JSON.stringify(point.Quality) },
              }
            }
            logger.error(`point: ${point.ItemId} is invalid:${JSON.stringify(point)}`, this.logSource)
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
          logger.debug(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${dateString}`, this.logSource)

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
          logger.warn(`unknown messageObject.Reply ${messageObject.Reply}`, this.logSource)
      }
    } catch (error) {
      logger.error(error, this.logSource)
    }
  }
}

module.exports = OPCHDA
