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

    this.scanGroups = this.dataSource.scanGroups.map((scanGroup) => {
      const points = this.dataSource.points.filter((point) => point.scanMode === scanGroup.scanMode).map((point) => point.pointId)
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
      const databasePath = `${this.engine.config.engine.caching.cacheFolder}/${dataSourceId}.db`
      this.configDatabase = await databaseService.createConfigDatabase(databasePath)

      const defaultLastCompletedAt = startTime ? new Date(startTime).getTime() : new Date().getTime()
      Object.keys(this.lastCompletedAt)
        .forEach(async (key) => {
          let lastCompletedAt = await databaseService.getConfig(this.configDatabase, `lastCompletedAt-${key}`)
          lastCompletedAt = lastCompletedAt ? parseInt(lastCompletedAt, 10) : defaultLastCompletedAt
          this.logger.info(`Initializing lastCompletedAt for ${key} with ${lastCompletedAt}`)
          this.lastCompletedAt[key] = lastCompletedAt
        })

      // Launch Agent
      const { agentFilename, tcpPort } = this.dataSource
      this.tcpServer = new TcpServer(tcpPort, this.logger, this.handleMessage.bind(this))
      this.tcpServer.start(() => {
        this.launchAgent(agentFilename, tcpPort)
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
   * @returns {void}
   */
  launchAgent(path, port) {
    this.logger.info(`Launching ${path} with the arguments: listen -p ${port}`)
    this.child = spawn(path, ['listen', `-p ${port}`])

    this.child.stdout.on('data', (data) => {
      this.logger.debug(`HDA stdout: ${data}`)
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
    if ((!this.ongoingReads[scanMode]) && this.agentReady) {
      const message = {
        Request: 'Read',
        TransactionId: this.generateTransactionId(),
        Content: {
          Group: scanMode,
          StartTime: this.lastCompletedAt[scanMode],
        },
      }
      this.sendMessage(message)
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
    if ((this.tcpServer) && (this.agentConnected)) {
      if (message.Request === 'Read') {
        this.ongoingReads[message.Content.Group] = true
      }

      const messageString = JSON.stringify(message)
      this.logger.debug(`Sent at ${new Date().toISOString()}: ${messageString}`)
      this.tcpServer.sendMessage(messageString)
    }
  }

  async handleMessage(message) {
    try {
      this.logger.debug(`Received: ${message}`)
      let messageObject
      try {
        messageObject = JSON.parse(message)
      } catch (error) {
        this.logger.error('Invalid JSON format received from Agent', error)
      }

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
            this.logger.error(`Unable to connect to ${this.dataSource.serverName} on ${this.dataSource.host}: ${messageObject.Content.Error}`)
          }
          break
        case 'Initialize':
          this.agentReady = true
          this.logger.debug('received Initialize message')
          break
        case 'Read':
          if (messageObject.Content.Error) {
            this.logger.error(messageObject.Content.Error)
          } else {
            this.logger.debug(`Received ${messageObject.Content.Points.length} values for ${messageObject.Content.Group}`)
            messageObject.Content.Points.forEach((point) => {
              const value = {
                pointId: point.ItemId,
                timestamp: new Date(point.Timestamp).getTime(),
                data: JSON.stringify(point.Value),
              }
              this.addValue(value, false)
            })

            dateString = messageObject.Content.Points.slice(-1).pop().Timestamp
            this.lastCompletedAt[messageObject.Content.Group] = new Date(dateString).getTime() + 1
            await databaseService.upsertConfig(
              this.configDatabase,
              `lastCompletedAt-${messageObject.Content.Group}`,
              this.lastCompletedAt[messageObject.Content.Group],
            )
            this.logger.debug(`Updated lastCompletedAt for ${messageObject.Content.Group} to ${dateString}`)

            this.ongoingReads[messageObject.Content.Group] = false
          }
          break
        case 'Disconnect':
          this.agentReady = false
          this.agentConnected = false
          break
        case 'Stop':
          this.tcpServer.stop()
          break
        default:
      }
    } catch (error) {
      this.logger.error(error)
    }
  }
}

OPCHDA.schema = require('./schema')

module.exports = OPCHDA
