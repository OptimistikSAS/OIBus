const jsmodbus = require('jsmodbus')
const net = require('net')
const getOptimizedConfig = require('./config/getOptimizedConfig')
const Protocol = require('../Protocol.class')

/**
 * Gives a type to a point based on the config
 */
const giveType = (point) => {
  this.engine.types.forEach((typeCompared) => {
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
        console.error('Modbus points cannot contain more than 1 field')
      }
    }
  })
}

/**
 * Class Modbus : provides instruction for Modbus client connection
 */
class Modbus extends Protocol {
  /**
   * @constructor for Modbus
   * @param {String} configPath : path to the non-optimized configuration file
   * @param {Object} engine
   */
  constructor(equipment, engine) {
    super(engine)
    const { addressGap } = this.engine.south.Modbus
    this.optimizedConfig = getOptimizedConfig(this, addressGap)
    this.socket = new net.Socket()
    this.host = equipment.Modbus.host
    this.port = equipment.Modbus.port
    this.connected = false
    this.client = new jsmodbus.client.TCP(this.socket)
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode : cron time
   * @return {void}
   */
  onScan(scanMode) {
    const { connected, optimizedConfig } = this
    const scanGroup = optimizedConfig[scanMode]
    // ignore if scanMode if not relevant to this equipment/ or not connected
    /** @todo we should likely filter onScan at the engine level */
    if (!scanGroup || !connected) return

    Object.keys(scanGroup).forEach((type) => {
      const addressesForType = scanGroup[type] // Addresses of the group
      // Build function name, IMPORTANT: type must be singular
      const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s`
      // Dynamic call of the appropriate function based on type
      Object.entries(addressesForType).forEach(([range, points]) => {
        points.forEach(point => giveType(point))
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
   * @param {String} funcName : name of the function to run
   * @param {Object} infos : informations about the group of addresses (first address of the group, size)
   * @param {String} equipmentId : identifier for the Modbus equipment the request is sent to
   * @param {Object} points : the points to read
   * @return {void}
   */
  modbusFunction(funcName, { startAddress, rangeSize }, points) {
    this.client[funcName](startAddress, rangeSize)
      .then(({ response }) => {
        const timestamp = `${new Date()}`
        points.forEach((point) => {
          const position = parseInt(point.Modbus.address, 16) - startAddress - 1
          let data = response.body.valuesAsArray[position]
          switch (point.type) {
            case 'boolean':
              data = !!data
              break
            case 'number':
              break
            default:
              console.error('This point type was not recognized : ', point.type)
          }
          const value = {
            pointId: point.pointId,
            timestamp,
            dataId: point.dataId,
            data,
          }
          this.engine.addValue(value)
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  /**
   * Initiates a connection for every equipment to the right host and port.
   * @return {void}
   */
  connect() {
    const { host, port } = this

    this.socket.connect(
      { host, port },
      () => {
        this.equipment.connected = true
      },
    )
    this.socket.on('error', (err) => {
      console.error(err)
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
