const jsmodbus = require('jsmodbus')
const net = require('net')
const optimizedConfig = require('./config/optimizedConfig')
const Protocol = require('../Protocol.class')

/**
 * Class Modbus : provides instruction for Modbus client connection
 */
class Modbus extends Protocol {
  /**
   * Constructor for Modbus
   * @param {String} configPath : path to the non-optimized configuration file
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
    if (!this.connected) console.error('You must be connected before calling onScan.')

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
   * @return {void}
   */
  modbusFunction(funcName, { startAddress, rangeSize }, equipmentId, points) {
    console.log(funcName, startAddress, rangeSize)
    this.equipments[equipmentId].client[funcName](startAddress, rangeSize)
      .then(({ response }) => {
        const timestamp = `${new Date()}`
        points.forEach((point) => {
          const position = parseInt(point.Modbus.address, 16) - startAddress - 1
          let data = response.body.valuesAsArray[position]
          if (point.pointId === '/fttest.base/Tank4.tank/111111.flow_rate#value') {
            console.log(response, position, data, response.body.valuesAsArray[position])
          }
          switch (point.type) {
            case 'boolean':
              data = !!data
              break
            case 'number':
              break
            default: console.error('This point type was not recognized : ', point.type)
          }
          this.engine.addValue({ pointId: point.pointId, timestamp, data })
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  /**
   * Initiates a connection to the given host on port 502
   * @param {String} host : host ip address
   * @param {Function} : callback function
   * @return {void}
   * @todo why 502 is hardcoded?
   */
  connect() {
    try {
      Object.entries(this.equipments).forEach(([equipmentId, equipment]) => {
        const { host, port } = equipment
        this.equipments[equipmentId].socket.connect({ host, port })
      })
    } catch (error) {
      console.log(error)
    }

    this.connected = true
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    this.socket.end()
    this.connected = false
  }
}

module.exports = Modbus
