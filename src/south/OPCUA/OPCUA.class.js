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
    const { url, maxAge, maxReturnValues, maxReadInterval } = dataSource.OPCUA
    this.url = url
    this.maxAge = maxAge || 10
    this.maxReturnValues = maxReturnValues
    this.maxReadInterval = maxReadInterval

    this.lastCompletedAt = {}
    this.ongoingReads = {}

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
    // Disable ESLint check because we need for..in loop to support async calls
    // eslint-disable-next-line no-restricted-syntax
    for (const scanGroup in Object.keys(this.lastCompletedAt)) {
      if ({}.hasOwnProperty.call(this.lastCompletedAt, scanGroup)) {
        // Disable ESLint check because we want to get the values one by one to avoid parallel access to the SQLite database
        // eslint-disable-next-line no-await-in-loop
        let lastCompletedAt = await databaseService.getConfig(this.configDatabase, `lastCompletedAt-${scanGroup}`)
        lastCompletedAt = lastCompletedAt ? parseInt(lastCompletedAt, 10) : defaultLastCompletedAt
        this.logger.info(`Initializing lastCompletedAt for ${scanGroup} with ${lastCompletedAt}`)
        this.lastCompletedAt[scanGroup] = lastCompletedAt
      }
    }

    try {
      // define OPCUA connection parameters
      const connectionStrategy = {
        initialDelay: 1000,
        maxRetry: 1,
      }
      const options = {
        applicationName: 'MyClient',
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
    }
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   * @todo check if every async and await is useful
   * @todo on the very first Scan dataSource.session might not be created yet, find out why
   */
  async onScan(scanMode) {
    const scanGroup = this.scanGroups.find((item) => item.scanMode === scanMode)
    console.info(scanGroup)

    if (!this.connected || this.ongoingReads[scanMode] || !scanGroup.points.length) return

    try {
      const nodesToRead = scanGroup.points.map((point) => ({ nodeId: point }))
      console.info(nodesToRead)
      const dataValues = await this.session.readHistoryValue(nodesToRead, this.lastCompletedAt[scanMode], new Date())
      if (dataValues.length !== nodesToRead.length) {
        this.logger.error(`received ${dataValues.length}, requested ${nodesToRead.length}`)
      }
      console.info(dataValues)
    } catch (error) {
      console.error(error)
      this.logger.error(error)
    }

    /*
    if (!this.connected || !scanGroup.length) return
    const nodesToRead = scanGroup.map((point) => ({ nodeId: point.nodeId, attributeId: Opcua.AttributeIds.Value }))
    try {
      const dataValues = await this.session.read(nodesToRead, this.maxAge)
      if (dataValues.length !== nodesToRead.length) {
        this.logger.error(`received ${dataValues.length}, requested ${nodesToRead.length}`)
      }
      const values = dataValues.map((dataValue, i) => (
        {
          pointId: nodesToRead[i].nodeId.toString(),
          data: dataValue.value.value,
          // todo: use parameter to select the right time stamp
          timestamp: dataValue.serverTimestamp.toUTCString(),
        }
      ))
      this.addValues(values)
    } catch (error) {
      this.logger.error(error)
    }
     */
  }

  /**
   * Close the connection
   * @return {void}
   */
  async disconnect() {
    if (this.connected) {
      await this.session.close()
      await this.client.disconnect()
      this.connected = false
    }
  }
}

module.exports = OPCUA
