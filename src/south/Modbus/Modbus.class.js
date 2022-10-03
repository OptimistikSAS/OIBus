const net = require('node:net')

const jsmodbus = require('jsmodbus')

const { getOptimizedScanModes, readRegisterValue } = require('./utils')
const SouthConnector = require('../SouthConnector.class')

/**
 * Class Modbus - Provides instruction for Modbus client connection
 */
class Modbus extends SouthConnector {
  static category = 'IoT'

  /**
   * Constructor for Modbus
   * @constructor
   * @param {Object} settings - The South connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine, {
      supportListen: false,
      supportLastPoint: true,
      supportFile: false,
      supportHistory: false,
    })
    this.handlesPoints = true

    const {
      addressOffset,
      retryInterval,
      host,
      port,
      slaveId,
      endianness,
      swapWordsInDWords,
      swapBytesInWords,
    } = this.settings.Modbus

    this.host = host
    this.port = port
    this.slaveId = slaveId
    this.retryInterval = retryInterval
    this.endianness = endianness
    this.swapWordsInDWords = swapWordsInDWords
    this.swapBytesInWords = swapBytesInWords
    this.optimizedScanModes = getOptimizedScanModes(this.settings.points, addressOffset, this.logger)

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
    const scanGroup = this.optimizedScanModes[scanMode]

    await Promise.all(Object.keys(scanGroup).map((modbusType) => {
      const funcName = `read${`${modbusType.charAt(0).toUpperCase()}${modbusType.slice(1)}`}s`
      return Promise.all(Object.entries(scanGroup[modbusType]).map(([range, points]) => {
        const rangeAddresses = range.split('-')
        const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
        const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
        const rangeSize = endAddress - startAddress // Size of the addresses group
        return this.modbusFunction(funcName, { startAddress, rangeSize }, points)
      }))
    }))
  }

  /**
   * Dynamically call the right function based on the given name
   * @param {String} funcName - Name of the function to run
   * @param {Object} infos - Information about the group of addresses (first address of the group, size)
   * @param {Object} points - the points to read
   * @returns {Promise<void>} - The result promise
   */
  async modbusFunction(funcName, { startAddress, rangeSize }, points) {
    if (!this.client[funcName]) {
      throw new Error(`Modbus function name "${funcName}" not recognized.`)
    }
    const modbusOptions = {
      endianness: this.endianness,
      swapWordsInDWords: this.swapWordsInDWords,
      swapBytesInWords: this.swapBytesInWords,
    }
    try {
      const { response } = await this.client[funcName](startAddress, rangeSize)
      const timestamp = new Date().toISOString()
      const valuesToSend = points.map((point) => {
        const position = point.address - startAddress - 1
        const data = readRegisterValue(response, point, position, modbusOptions)
        return {
          pointId: point.pointId,
          timestamp,
          data: { value: JSON.stringify(parseFloat((data * point.multiplierCoefficient).toFixed(5))) },
        }
      })
      await this.addValues(valuesToSend)
    } catch (error) {
      if (error?.err === 'Offline') {
        this.logger.error('Modbus server offline.')
        await this.disconnect()
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.retryInterval)
      } else {
        throw error
      }
    }
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
      this.client = new jsmodbus.client.TCP(this.socket, this.slaveId)
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

module.exports = Modbus
