const jsmodbus = require('jsmodbus')
const net = require('net')

const { getOptimizedScanModes } = require('./config/getOptimizedConfig')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class Modbus - Provides instruction for Modbus client connection
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
    this.optimizedScanModes = getOptimizedScanModes(this.dataSource.points, this.dataSource.Modbus.addressOffset, this.logger)
    this.connected = false
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode - Cron time
   * @return {void}
   */
  onScan(scanMode) {
    const { connected, optimizedScanModes } = this
    const scanGroup = optimizedScanModes[scanMode]

    if (!scanGroup || !connected) {
      this.logger.debug(`onScan ignored: connected:${connected}, scanMode:${scanMode}`)
      return
    }

    Object.keys(scanGroup).forEach((modbusType) => {
      const funcName = `read${`${modbusType.charAt(0).toUpperCase()}${modbusType.slice(1)}`}s`
      Object.entries(scanGroup[modbusType]).forEach(([range, points]) => {
        const rangeAddresses = range.split('-')
        const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
        const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
        const rangeSize = endAddress - startAddress // Size of the addresses group
        this.modbusFunction(funcName, { startAddress, rangeSize }, points)
      })
    })
  }

  /**
   * Read point value according to it's data type (UInt16, UInt32, etc)
   * @param {Object} response Response of the modbus request
   * @param {Object} point The point to read
   * @param {Number} position Position of the point in the response
   * @return {Number} Value stored at the specified address
   */
  readRegisterValue(response, point, position) {
    if (response.body.constructor.name === 'ReadCoilsResponseBody' || response.body.constructor.name === 'ReadDiscreteInputsResponseBody') {
      return response.body.valuesAsArray[position]
    }
    const endianness = this.dataSource.Modbus.endianness === 'Big Endian' ? 'BE' : 'LE'
    const funcName = `read${point.dataType}${endianness}`
    /* Here, the position must be multiplied by 2 because the jsmodbus library is set to read addresses values on 16 bits (2 bytes),
      but in the valuesAsBuffer field each cell of the array contains 8 bits (1 byte) */
    return response.body.valuesAsBuffer[funcName](position * 2)
  }

  /**
   * Dynamically call the right function based on the given name
   * @param {String} funcName - Name of the function to run
   * @param {Object} infos - Information about the group of addresses (first address of the group, size)
   * @param {Object} points - the points to read
   * @return {void}
   */
  modbusFunction(funcName, { startAddress, rangeSize }, points) {
    if (this.modbusClient[funcName]) {
      this.modbusClient[funcName](startAddress, rangeSize)
        .then(({ response }) => {
          const timestamp = new Date().toISOString()
          points.forEach((point) => {
            const position = point.address - startAddress - 1
            /** @todo: below should send by batch instead of single points */
            this.addValues([
              {
                pointId: point.pointId,
                timestamp,
                data: { value: JSON.stringify(this.readRegisterValue(response, point, position)) },
              },
            ])
          })
        })
        .catch((error) => {
          this.logger.error(`Modbus onScan error: for ${startAddress} and ${rangeSize}, ${funcName} error : ${JSON.stringify(error)}`)
        })
    } else {
      this.logger.error(`Modbus function name ${funcName} not recognized`)
    }
  }

  /**
   * Initiates a connection for every data source to the right host and port.
   * @return {void}
   */
  async connect() {
    await super.connect()
    this.socket = new net.Socket()
    const { host, port, slaveId } = this.dataSource.Modbus
    this.modbusClient = new jsmodbus.client.TCP(this.socket, slaveId)
    this.socket.connect(
      { host, port },
      () => {
        this.connected = true
      },
    )
    this.socket.on('error', (error) => {
      this.logger.error(`Modbus connect error: ${JSON.stringify(error)}`)
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
