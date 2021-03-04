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
    this.connected = false
    this.netId = this.dataSource.ADS.netId
    this.port = this.dataSource.ADS.port
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

    const nodesToRead = this.dataSource.points
      .filter((point) => point.scanMode === scanMode)
      .map((point) => point.address)
    if (!nodesToRead.length) {
      this.logger.error(`onScan ignored: no points to read for scanMode: ${scanMode}`)
      return
    }

    try {
      this.dataSource.points
        .filter((point) => point.scanMode === scanMode)
        .forEach((point) => {
          this.client.readSymbol(point.address)
            .then((res) => {
              this.addValues([
                {
                  pointId: point.pointId,
                  timestamp: new Date().toISOString(),
                  data: { value: JSON.stringify(res) },
                },
              ])
            })
            .catch((err) => {
              this.logger.error(`ADS onScan error for ${point.address}: ${err}`)
            })
        })
    } catch (error) {
      this.logger.error(`on Scan ${scanMode}:${error.stack}`)
    }
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
    })

    this.client.connect()
      .then((res) => {
        this.connected = true
        this.logger.info(`Connected to the ${res.targetAmsNetId}`)
        this.logger.info(`Router assigned AmsNetId ${res.localAmsNetId} and port ${res.localAdsPort} to this client`)
      })
      .catch((error) => {
        this.connected = false
        this.logger.error(`ADS connect error: ${JSON.stringify(error)}`)
      })
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    if (this.connected) {
      this.client.disconnect()
        .then(() => {
          this.logger.info(`ADS client disconnected from ${this.netId}:${this.port}`)
        })
        .catch(() => {
          this.logger.error(`ADS client error while disconnecting from ${this.netId}:${this.port}`)
        })
        .finally(() => {
          this.connected = false
        })
    }
  }
}

module.exports = ADS
