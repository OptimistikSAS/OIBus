const modbus = require('jsmodbus')
const net = require('net')
const getConfig = require('./config/modbus.config')

/**
 * Class ModbusClient : provides instruction for modbus client connection
 */
class ModbusClient {
  /**
   * Constructor for ModbusClient
   * @param {String} configPath : path to the non-optimized configuration file
   */
  constructor(configPath) {
    this.socket = new net.Socket()
    this.client = new modbus.client.TCP(this.socket)
    this.connected = false
    this.optimizedConfig = getConfig(configPath)
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode : cron time
   * @return {void}
   */
  pol = (scanMode) => {
    if (this.connected) {
      const scanGroup = this.optimizedConfig[scanMode]
      Object.keys(scanGroup).forEach((equipment) => {
        Object.keys(scanGroup[equipment]).forEach((type) => {
          const addressesForType = scanGroup[equipment][type] // Addresses of the group

          const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s` // Build function name, IMPORTANT: type must be singular

          // Dynamic call of the appropriate function based on type
          const modbusFunction = (startAddress, count) =>
            this.client[funcName](startAddress, count)
              .then((resp) => {
                console.log('Response: ', JSON.stringify(resp.response))
              })
              .catch((error) => {
                console.error(error)
                this.disconnect()
              })

          Object.keys(addressesForType).forEach((range) => {
            const rangeAddresses = range.split('-')
            const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
            const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
            const rangeSize = endAddress - startAddress // Size of the addresses group
            modbusFunction(startAddress, rangeSize)
          })
        })
      })
    } else {
      console.error('You must be connected to run pol.')
    }
  }

  /**
   * Initiates a connection to the given host on port 502
   * @param {String} host : host ip address
   * @param {Function} : callback function
   * @return {void}
   */
  connect = (host) => {
    this.socket.connect({ host, port: 502 })
    this.connected = true
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect = () => {
    this.socket.end()
    this.connected = false
  }
}

module.exports = ModbusClient
