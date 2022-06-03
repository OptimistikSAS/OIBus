const jsmodbus = require('jsmodbus')
const net = require('net')

const { getOptimizedScanModes } = require('./config/getOptimizedConfig')
const ProtocolHandler = require('../ProtocolHandler.class')

/**
 * Class Modbus - Provides instruction for Modbus client connection
 */
class Modbus extends ProtocolHandler {
  static category = 'IoT'

  /**
   * Constructor for Modbus
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, { supportListen: false, supportLastPoint: true, supportFile: false, supportHistory: false })
    const { addressOffset, retryInterval } = this.dataSource.Modbus

    this.optimizedScanModes = getOptimizedScanModes(this.dataSource.points, addressOffset, this.logger)
    this.connected = false
    this.reconnectTimeout = null

    this.retryInterval = retryInterval // retry interval before trying to connect again
    this.handlesPoints = true
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode - Cron time
   * @return {void}
   */
  lastPointQuery(scanMode) {
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

    let responseBuffer = response.body.valuesAsBuffer
    // transform 01 02 03 04 into 03 04 01 02
    if (this.dataSource.Modbus.swapWordsInDWords && !['Int16', 'UInt16'].includes(point.dataType)) {
      responseBuffer = responseBuffer.swap32().swap16()
    }

    // transform 01 02 03 04 into 02 01 04 03
    if (this.dataSource.Modbus.swapBytesInWords) {
      responseBuffer = responseBuffer.swap16()
    }
    /* Here, the position must be multiplied by 2 because the jsmodbus library is set to read addresses values on 16 bits (2 bytes),
      but in the valuesAsBuffer field each cell of the array contains 8 bits (1 byte) */
    return responseBuffer[funcName](position * 2)
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
            const data = this.readRegisterValue(response, point, position)
            /** @todo: below should send by batch instead of single points */
            this.addValues([
              {
                pointId: point.pointId,
                timestamp,
                data: { value: JSON.stringify(parseFloat((data * point.multiplierCoefficient).toFixed(5))) },
              },
            ])
          })
        })
        .catch((error) => {
          this.logger.error(`Modbus onScan error: for ${startAddress} and ${rangeSize}, ${funcName} error : ${JSON.stringify(error)}`)
          if (error && error.err === 'Offline') {
            this.disconnect()
            this.reconnectTimeout = setTimeout(this.connectorToModbusServer.bind(this), this.retryInterval)
          }
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
    this.connectorToModbusServer()
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
      this.socket.end()
      this.connected = false
      this.statusData['Connected at'] = 'Not connected'
      this.updateStatusDataStream()
    }
    await super.disconnect()
  }

  connectorToModbusServer() {
    this.reconnectTimeout = null
    this.socket = new net.Socket()
    const { host, port, slaveId } = this.dataSource.Modbus
    this.modbusClient = new jsmodbus.client.TCP(this.socket, slaveId)
    this.socket.connect(
      { host, port },
      () => {
        this.connected = true
        this.statusData['Connected at'] = new Date().toISOString()
        this.updateStatusDataStream()
      },
    )
    this.socket.on('error', (error) => {
      this.logger.error(`Modbus connect error: ${JSON.stringify(error)}`)
      this.disconnect()
      this.reconnectTimeout = setTimeout(this.connectorToModbusServer.bind(this), this.retryInterval)
    })
  }
}

module.exports = Modbus
