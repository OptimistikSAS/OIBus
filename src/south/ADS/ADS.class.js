const ads = require('ads-client')

const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class ADS - Provides instruction for Modbus client connection
 */
class ADS extends ProtocolHandler {
  /**
   * Constructor for ADS
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)
    const { netId, port, clientAmsNetId, clientAdsPort, routerAddress, routerTcpPort, retryInterval } = this.dataSource.ADS
    this.connected = false
    this.netId = netId
    this.port = port
    this.clientAmsNetId = clientAmsNetId
    this.clientAdsPort = clientAdsPort
    this.routerAddress = routerAddress
    this.routerTcpPort = routerTcpPort
    this.retryInterval = retryInterval
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode - Cron time
   * @return {void}
   */
  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
   */
  async onScan(scanMode) {
    if (!this.connected) {
      this.logger.silly(`onScan ignored: connected: ${this.connected}`)
      return
    }

    const nodesToRead = this.dataSource.points.filter((point) => point.scanMode === scanMode)
    if (!nodesToRead.length) {
      this.logger.error(`onScan ignored: no points to read for scanMode: ${scanMode}`)
      return
    }

    await nodesToRead.forEach((node) => {
      this.client.readSymbol(node.address)
        .then((nodeResult) => {
          this.addValues([
            {
              pointId: node.pointId,
              timestamp: new Date().toISOString(),
              data: { value: JSON.stringify(nodeResult.value) },
            },
          ])
        })
        .catch((error) => {
          this.logger.error(`on Scan ${scanMode}:${error.stack}`)
        })
    })
  }

  /**
   * Initiates a connection for every data source to the right netId and port.
   * @return {void}
   */
  async connect() {
    await super.connect()
    this.client = new ads.Client({
      targetAmsNetId: this.netId, // example: 192.168.1.120.1.1
      targetAdsPort: this.port, // example: 851
      localAmsNetId: this.clientAmsNetId, // needs to match a route declared in PLC StaticRoutes.xml file. Example: 10.211.55.2.1.1
      localAdsPort: this.clientAdsPort, // should be an unused port. Example: 32750
      routerAddress: this.routerAddress, // distant address of the PLC. Example: 10.211.55.3
      routerTcpPort: this.routerTcpPort, // port of the Ams router (must be open on the PLC). Example : 48898 (which is default)
    })

    await this.connectToAdsServer()
  }

  async connectToAdsServer() {
    this.reconnectTimeout = null
    try {
      const result = await this.client.connect()
      this.connected = true
      this.logger.info(`Connected to the ${result.targetAmsNetId} with local AmsNetId ${result.localAmsNetId} and local port ${result.localAdsPort}`)
    } catch (error) {
      this.connected = false
      this.logger.error(`ADS connect error: ${JSON.stringify(error)}`)
      this.reconnectTimeout = setTimeout(this.connectToAdsServer.bind(this), this.retryInterval)
    }
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    if (this.connected) {
      this.client.disconnect()
        .finally(() => {
          this.logger.info(`ADS client disconnected from ${this.netId}:${this.port}`)
          this.connected = false
        })
    }
  }
}

module.exports = ADS
