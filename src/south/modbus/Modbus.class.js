const jsmodbus = require('jsmodbus')
const net = require('net')
const optimizedConfig = require('./config/optimizedConfig')
const Protocol = require('../Protocol.class')

/**
 * Class Modbus : provides instruction for Modbus client connection
 */
class Modbus extends Protocol {
  /**
   * @constructor for Modbus
   * @param {String} configPath : path to the non-optimized configuration file
   * @param {Object} engine
   */
  constructor({ equipments, modbus }, engine) {
    super(engine)
    this.equipments = {}
    this.connected = false
    this.optimizedConfig = optimizedConfig(equipments, modbus.addressGap)
    Object.values(equipments).forEach(equipment => this.add(equipment))
  }

  /** Adds equipment entry in equipments
   * @param {Object} equipment
   * @return {void}
   */
  add(equipment) {
    this.equipments[equipment.equipmentId] = {
      socket: new net.Socket(),
      host: equipment.Modbus.host,
      port: equipment.Modbus.port,
    }
    this.equipments[equipment.equipmentId].client = new jsmodbus.client.TCP(this.equipments[equipment.equipmentId].socket)
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode : cron time
   * @return {void}
   */
  onScan(scanMode) {
    if (!this.connected) {
      console.error('You must be connected before calling onScan.')
      return
    }
    const scanGroup = this.optimizedConfig[scanMode]
    Object.keys(scanGroup).forEach((equipment) => {
      Object.keys(scanGroup[equipment]).forEach((type) => {
        const addressesForType = scanGroup[equipment][type] // Addresses of the group
        // Build function name, IMPORTANT: type must be singular
        const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s`

        // Dynamic call of the appropriate function based on type

        Object.entries(addressesForType).forEach(([range, points]) => {
          const rangeAddresses = range.split('-')
          const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
          const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
          const rangeSize = endAddress - startAddress // Size of the addresses group
          this.modbusFunction(funcName, { startAddress, rangeSize }, equipment, points)
        })
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
  modbusFunction(funcName, { startAddress, rangeSize }, equipmentId, points) {
    this.equipments[equipmentId].client[funcName](startAddress, rangeSize)
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
          this.engine.addValue({ pointId: point.pointId, timestamp, data })
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
    Object.values(this.equipments).forEach((equipment) => {
      const { host, port } = equipment

      equipment.socket.connect(
        { host, port },
        () => {
          this.connected = true
        },
      )
      equipment.socket.on('error', (err) => {
        console.error(err)
        this.connected = false
      })
    })
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    Object.values(this.equipments).forEach((equipment) => {
      equipment.socket.end()
    })
    this.connected = false
  }
}

module.exports = Modbus
