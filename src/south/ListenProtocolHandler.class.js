const ProtocolHandler = require('./ProtocolHandler.class')

/**
 * Class ListenProtocolHandlerClass: provides general attributes and methods for "Listen" type South Protocols.
 * Building a new "Listen" type South Protocol means to extend this class, and to surcharge
 * the following methods:
 * - **listen**: A special scanMode can be created for a protocol (for example MQTT). In this configuration, the
 * driver will be able to "listen" for updated values.
 * - **connect**: to allow to establish proper connection to the data source(optional)
 * - **disconnect**: to allow proper disconnection (optional)
 * In addition, it is possible to use a number of helper functions:
 *
 * All other operations (cache, store&forward, communication to North applications) will be
 * handled by the OIBus engine and should not be taken care at the South level.
 *
 */
class ListenProtocolHandler extends ProtocolHandler {
  /**
   * Constructor for ListenProtocolHandlerClass
   * @constructor
   * @param {*} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    this.handlesPoints = true
  }

  /**
   * The onScan method is silently ignored in case of "Listen" type South Protocols.
   * @param _scanMode
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line class-methods-use-this,no-empty-function
  async onScan(_scanMode) {
  }

  /**
   * The listen method implements the subscription for the points.
   * @param {object} _data - The data required to configure listening
   * @returns {void}
   */
  listen(_data) {
    const { dataSourceId } = this.dataSource
    this.logger.error(`Data source ${dataSourceId} should surcharge listen()`)
  }
}

module.exports = ListenProtocolHandler
