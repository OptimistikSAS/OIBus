import net from 'node:net'

import modbus from 'jsmodbus'

import SouthConnector from '../south-connector.ts'
import getNumberOfWords from './utils.js'
import manifest from './manifest.ts'

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus extends SouthConnector {
  static category = manifest.category

  /**
   * Constructor for SouthModbus
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {ProxyService} proxyService - The proxy service
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxyService,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      proxyService,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      manifest,
    )

    const {
      addressOffset,
      retryInterval,
      host,
      port,
      slaveId,
      endianness,
      swapWordsInDWords,
      swapBytesInWords,
    } = configuration.settings

    this.host = host
    this.port = port
    this.slaveId = slaveId
    this.retryInterval = retryInterval
    this.endianness = endianness
    this.swapWordsInDWords = swapWordsInDWords
    this.swapBytesInWords = swapBytesInWords
    this.addressOffset = addressOffset

    // Initialized at connection
    this.reconnectTimeout = null
    this.socket = null
    this.client = null
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode - The scan mode
   * @returns {Promise<void>} - The result promise
   */
  async lastPointQuery(scanMode) {
    const pointsToRead = this.points.filter((point) => point.scanMode === scanMode)

    try {
      await pointsToRead.reduce((promise, point) => promise.then(
        async () => this.modbusFunction(point),
      ), Promise.resolve())
    } catch (error) {
      if (error.err === 'Offline') {
        this.logger.error('Modbus server offline.')
        await this.disconnect()
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
      } else {
        throw new Error(error.err)
      }
    }
  }

  /**
   * Dynamically call the right function based on the given point settings
   * @param {Object} point - the point to read
   * @returns {Promise<void>} - The result promise
   */
  async modbusFunction(point) {
    const offset = this.addressOffset === 'Modbus' ? 0 : -1
    const address = (point.address.match(/^0x[0-9a-f]+$/i) ? parseInt(point.address, 16)
      : parseInt(point.address, 10)) + offset

    let value
    switch (point.modbusType) {
      case 'coil':
        value = await this.readCoil(address, point.multiplierCoefficient)
        break
      case 'discreteInput':
        value = await this.readDiscreteInputRegister(address, point.multiplierCoefficient)
        break
      case 'inputRegister':
        value = await this.readInputRegister(address, point.multiplierCoefficient, point.dataType)
        break
      case 'holdingRegister':
        value = await this.readHoldingRegister(address, point.multiplierCoefficient, point.dataType)
        break
      default:
        throw new Error(`Wrong Modbus type "${point.modbusType}" for point ${JSON.stringify(point)}`)
    }
    const formattedData = {
      pointId: point.pointId,
      timestamp: new Date().toISOString(),
      data: { value: JSON.stringify(value) },
    }
    await this.addValues([formattedData])
  }

  /**
   * Read a Modbus coil
   * @param {Number} address - The address to query
   * @returns {Promise<Number>} - The coil value
   */
  async readCoil(address) {
    const { response } = await this.client.readCoils(address, 1)
    return response.body.valuesAsArray[0]
  }

  /**
   * Read a Modbus discrete input register
   * @param {Number} address - The address to query
   * @returns {Promise<Number>} - The discrete input register value
   */
  async readDiscreteInputRegister(address) {
    const { response } = await this.client.readDiscreteInputs(address, 1)
    return response.body.valuesAsArray[0]
  }

  /**
   * Read a Modbus input register
   * @param {Number} address - The address to query
   * @param {Number} multiplier - The multiplier (usually 1, 0.1, 10...)
   * @param {String} dataType - The address to query
   * @returns {Promise<Number>} - The input register value
   */
  async readInputRegister(address, multiplier, dataType) {
    const numberOfWords = getNumberOfWords(dataType)
    const { response } = await this.client.readInputRegisters(address, numberOfWords)
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType)
  }

  /**
   * Read a Modbus holding register
   * @param {Number} address - The address to query
   * @param {Number} multiplier - The multiplier (usually 1, 0.1, 10...)
   * @param {String} dataType - The address to query
   * @returns {Promise<Number>} - The input register value
   */
  async readHoldingRegister(address, multiplier, dataType) {
    const numberOfWords = getNumberOfWords(dataType)
    const { response } = await this.client.readHoldingRegisters(address, numberOfWords)
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType)
  }

  /**
   * Retrieve a value from buffer with appropriate conversion according to the modbus settings
   * @param {Buffer} buffer - The buffer to parse
   * @param {Number} multiplier - The multiplier of the retrieve value (usually 0.1, 0.001, 10...
   * @param {'UInt16' | 'Int16' | 'UInt32' | 'Int32' | 'BigUInt64' | 'BigInt64' | 'Float' | 'Double'} dataType - The
   * data type to convert
   * @returns {Number} - The retrieved and parsed value
   */
  getValueFromBuffer(buffer, multiplier, dataType) {
    const endianness = this.endianness === 'Big Endian' ? 'BE' : 'LE'
    const bufferFunctionName = `read${dataType}${endianness}`
    if (!['Int16', 'UInt16'].includes(dataType)) {
      buffer.swap32().swap16()
      if (this.swapWordsInDWords) {
        buffer.swap16().swap32()
      }
      if (this.swapBytesInWords) {
        buffer.swap16()
      }
      const bufferValue = buffer[bufferFunctionName]()
      return parseFloat((bufferValue * multiplier).toFixed(5))
    }

    if (this.swapBytesInWords) {
      buffer.swap16()
    }

    const bufferValue = buffer[bufferFunctionName]()
    return parseFloat((bufferValue * multiplier).toFixed(5))
  }

  /**
   * Initiates a connection to the right host and port.
   * @returns {Promise<void>} - The result promise
   */
  async connect() {
    return new Promise((resolve) => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
      }
      this.socket = new net.Socket()
      this.client = new modbus.client.TCP(this.socket, this.slaveId)
      this.socket.connect(
        { host: this.host, port: this.port },
        async () => {
          await super.connect()
          resolve()
        },
      )
      this.socket.on('error', async (error) => {
        this.logger.error(error)
        await this.disconnect()
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
      })
    })
  }

  /**
   * Close the connection
   * @returns {Promise<void>} - The result promise
   */
  async disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    if (this.connected) {
      this.socket.end()
      this.socket = null
      this.connected = false
      this.client = null
    }
    await super.disconnect()
  }
}
