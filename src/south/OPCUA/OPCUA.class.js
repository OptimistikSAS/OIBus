const Opcua = require('node-opcua')
const ProtocolHandler = require('../ProtocolHandler.class')
const databaseService = require('../../services/database.service')

/**
 *
 *
 * @class OPCUA
 * @extends {ProtocolHandler}
 */
class OPCUA extends ProtocolHandler {
  /**
   * Constructor for OPCUA
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)
    const { url, retryInterval, maxReturnValues, maxReadInterval } = dataSource.OPCUA
    this.url = url
    this.retryInterval = retryInterval
    this.maxReturnValues = maxReturnValues
    this.maxReadInterval = maxReadInterval

    this.lastCompletedAt = {}
    this.ongoingReads = {}
    if (this.dataSource.OPCUA.scanGroups) {
      this.scanGroups = this.dataSource.OPCUA.scanGroups.map((scanGroup) => {
        const points = this.dataSource.points
          .filter((point) => point.scanMode === scanGroup.scanMode)
          .map((point) => point.nodeId)
        this.lastCompletedAt[scanGroup.scanMode] = new Date().getTime()
        this.ongoingReads[scanGroup.scanMode] = false
        return {
          name: scanGroup.scanMode,
          ...scanGroup,
          points,
        }
      })
    } else {
      this.logger.error('OPCUA scanGroups are not defined. This South driver will not work')
      this.scanGroups = []
    }

    this.reconnectTimeout = null
  }

  /**
   * Connect.
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    super.connect()

    // Initialize lastCompletedAt for every scanGroup
    const { dataSourceId, startTime } = this.dataSource
    const { engineConfig } = this.engine.configService.getConfig()
    const databasePath = `${engineConfig.caching.cacheFolder}/${dataSourceId}.db`
    this.configDatabase = await databaseService.createConfigDatabase(databasePath)

    const defaultLastCompletedAt = startTime ? new Date(startTime).getTime() : new Date().getTime()
    // Disable ESLint check because we need for..of loop to support async calls
    // eslint-disable-next-line no-restricted-syntax
    for (const scanGroup of Object.keys(this.lastCompletedAt)) {
      // Disable ESLint check because we want to get the values one by one to avoid parallel access to the SQLite database
      // eslint-disable-next-line no-await-in-loop
      let lastCompletedAt = await databaseService.getConfig(this.configDatabase, `lastCompletedAt-${scanGroup}`)
      lastCompletedAt = lastCompletedAt ? parseInt(lastCompletedAt, 10) : defaultLastCompletedAt
      this.logger.info(`Initializing lastCompletedAt for ${scanGroup} with ${lastCompletedAt}`)
      this.lastCompletedAt[scanGroup] = lastCompletedAt
    }

    await this.connectToOpcuaServer()
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async onScan(scanMode) {
    const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)

    if (!scanGroup) {
      this.logger.error(`onScan ignored: no scanGroup for ${scanMode}`)
      return
    }

    if (!this.connected || this.ongoingReads[scanMode]) {
      this.logger.silly(`onScan ignored: connected: ${this.connected},ongoingReads[${scanMode}]: ${this.ongoingReads[scanMode]}`)
      return
    }

    if (!scanGroup.points || !scanGroup.points.length) {
      this.logger.error(`onScan ignored: scanGroup.points undefined or empty: ${scanGroup.points}`)
      return
    }

    this.ongoingReads[scanMode] = true

    try {
      const nodesToRead = scanGroup.points.map((point) => point)
      let opcStartTime = new Date(this.lastCompletedAt[scanMode])
      const opcEndTime = new Date()
      let intervalOpcEndTime
      let maxTimestamp = opcStartTime.getTime()
      let values = []

      do {
        if ((opcEndTime.getTime() - opcStartTime.getTime()) > 1000 * this.maxReadInterval) {
          intervalOpcEndTime = new Date(opcStartTime.getTime() + 1000 * this.maxReadInterval)
        } else {
          intervalOpcEndTime = opcEndTime
        }

        this.logger.silly(`Read from ${opcStartTime.getTime()} to ${intervalOpcEndTime.getTime()} the nodes ${nodesToRead}`)
        // eslint-disable-next-line no-await-in-loop
        const dataValues = await this.session.readHistoryValue(nodesToRead, opcStartTime, intervalOpcEndTime)
        if (dataValues.length !== nodesToRead.length) {
          this.logger.error(`received ${dataValues.length}, requested ${nodesToRead.length}`)
        }
        // The response doesn't seem to contain any information regarding the nodeId,
        // so we iterate with a for loop and use the index to get the proper nodeId
        for (let i = 0; i < dataValues.length; i += 1) {
          // It seems that node-opcua doesn't take into account the millisecond part when requesting historical data
          // Reading from 1583914010001 returns values with timestamp 1583914010000
          // Filter out values with timestamp smaller than startTime
          // eslint-disable-next-line no-loop-func
          const newerValues = dataValues[i].historyData.dataValues.filter((dataValue) => {
            const serverTimestamp = dataValue.serverTimestamp.getTime()
            return serverTimestamp >= opcStartTime.getTime()
          })
          // eslint-disable-next-line no-loop-func
          values = values.concat(newerValues.map((dataValue) => {
            const serverTimestamp = dataValue.serverTimestamp.getTime()
            maxTimestamp = serverTimestamp > maxTimestamp ? serverTimestamp : maxTimestamp
            return {
              pointId: nodesToRead[i],
              timestamp: dataValue.serverTimestamp.toUTCString(),
              data: {
                value: dataValue.value.value,
                quality: JSON.stringify(dataValue.statusCode),
              },
            }
          }))
        }

        opcStartTime = intervalOpcEndTime
      } while (intervalOpcEndTime.getTime() !== opcEndTime.getTime())


      this.addValues(values)

      this.lastCompletedAt[scanMode] = maxTimestamp + 1
      await databaseService.upsertConfig(this.configDatabase, `lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode])
      this.logger.silly(`Updated lastCompletedAt for ${scanMode} to ${this.lastCompletedAt[scanMode]}`)
    } catch (error) {
      this.logger.error(`on Scan ${scanMode}: ${error}`)
    }

    this.ongoingReads[scanMode] = false
  }

  /**
   * Close the connection
   * @return {void}
   */
  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.connected) {
      await this.session.close()
      await this.client.disconnect()
      this.connected = false
    }
  }

  /**
   * Connect to OPCUA server with retry.
   * @returns {Promise<void>} - The connect promise
   */
  async connectToOpcuaServer() {
    this.reconnectTimeout = null

    try {
      // define OPCUA connection parameters
      const connectionStrategy = {
        initialDelay: 1000,
        maxRetry: 1,
      }
      const options = {
        applicationName: 'OIBus',
        connectionStrategy,
        securityMode: Opcua.MessageSecurityMode.None,
        securityPolicy: Opcua.SecurityPolicy.None,
        endpoint_must_exist: false,
      }
      this.client = Opcua.OPCUAClient.create(options)
      await this.client.connect(this.url)
      this.session = await this.client.createSession()
      this.connected = true
      this.logger.info('OPCUA Connected')
    } catch (error) {
      this.logger.error(error)
      this.reconnectTimeout = setTimeout(this.connectToOpcuaServer.bind(this), this.retryInterval)
    }
  }
}

module.exports = OPCUA
