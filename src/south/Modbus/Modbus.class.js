/* istanbul ignore file */

const jsmodbus = require('jsmodbus')
const net = require('net')
const getOptimizedConfig = require('./config/getOptimizedConfig')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Gives a type to a point based on the config
 * @param {Object} point - The point
 * @param {Array} types - The types
 * @param {Object} logger - The logger
 * @return {void}
 */
const giveType = (point, types, logger) => {
  types.forEach((typeCompared) => {
    if (
      typeCompared.type
      === point.pointId
        .split('.')
        .slice(-1)
        .pop()
    ) {
      point.type = typeCompared.fields[0].type
      point.dataId = typeCompared.fields[0].name
      if (typeCompared.fields.length > 1) {
        logger.error('Modbus points cannot contain more than 1 field')
      }
    }
  })
}

/**
 * Class Modbus - Provides instruction for Modbus client connection
 * @todo: Warning: this protocol needs rework to be production ready.
 */
class Modbus extends ProtocolHandler {
  /**
   * Constructor for Modbus
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)
    this.optimizedConfig = getOptimizedConfig(this.dataSource.points, this.dataSource.Modbus.addressGap)
    this.socket = new net.Socket()
    this.host = this.dataSource.Modbus.host
    this.port = this.dataSource.Modbus.port
    this.connected = false
    this.client = new jsmodbus.client.TCP(this.socket)
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode - Cron time
   * @return {void}
   */
  onScan(scanMode) {
    const { connected, optimizedConfig } = this
    const scanGroup = optimizedConfig[scanMode]
    // ignore if scanMode if not relevant to this data source/ or not connected
    /** @todo we should likely filter onScan at the engine level */
    if (!scanGroup || !connected) return

    Object.keys(scanGroup).forEach((type) => {
      const addressesForType = scanGroup[type] // Addresses of the group
      // Build function name, IMPORTANT: type must be singular
      const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s`
      // Dynamic call of the appropriate function based on type
      const { engineConfig } = this.engine.configService.getConfig()
      Object.entries(addressesForType).forEach(([range, points]) => {
        points.forEach((point) => giveType(point, engineConfig.types, this.logger))
        const rangeAddresses = range.split('-')
        const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
        const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
        const rangeSize = endAddress - startAddress // Size of the addresses group
        this.modbusFunction(funcName, { startAddress, rangeSize }, points)
      })
    })
  }

  /**
   * Dynamically call the right function based on the given name
   * @param {String} funcName - Name of the function to run
   * @param {Object} infos - Information about the group of addresses (first address of the group, size)
   * @param {Object} points - the points to read
   * @return {void}
   */
  modbusFunction(funcName, { startAddress, rangeSize }, points) {
    this.client[funcName](startAddress, rangeSize)
      .then(({ response }) => {
        const timestamp = new Date().toISOString()
        points.forEach((point) => {
          const position = parseInt(point.address, 16) - startAddress - 1
          let data = response.body.valuesAsArray[position]
          switch (point.type) {
            case 'boolean':
              data = !!data
              break
            case 'number':
              break
            default:
              this.logger.error(new Error(`This point type was not recognized: ${point.type}`))
          }
          /** @todo: below should send by batch instead of single points */
          this.addValues([
            {
              pointId: point.pointId,
              timestamp,
              data: { value: JSON.stringify(data) },
            },
          ])
        })
      })
      .catch((error) => {
        this.logger.error(error)
      })
  }

  /**
   * Initiates a connection for every data source to the right host and port.
   * @return {void}
   */
  connect() {
    super.connect()
    const { host, port } = this

    this.socket.connect(
      { host, port },
      () => {
        this.connected = true
      },
    )
    this.socket.on('error', (error) => {
      this.logger.error(error)
    })
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    if (this.connected) {
      this.socket.end()
      this.connected = false
    }
  }
}

module.exports = Modbus
