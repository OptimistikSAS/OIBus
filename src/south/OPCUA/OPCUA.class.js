const Opcua = require('node-opcua')
const ProtocolHandler = require('../ProtocolHandler.class')

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
    const { url, maxAge } = dataSource.OPCUA
    this.url = url
    this.maxAge = maxAge || 10
  }

  /**
   * Connect.
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    super.connect()
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
    }
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async onScan(scanMode) {
    /* @todo: ScanGroup should be calculated on startup and not on each scan */
    const scanGroup = this.dataSource.points.filter((point) => point.scanMode === scanMode)
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
      this.logger.error(`on Scan ${scanMode}: ${error}`)
    }
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
