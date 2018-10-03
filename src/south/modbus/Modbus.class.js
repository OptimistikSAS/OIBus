const jsmodbus = require('jsmodbus')
const net = require('net')
const optimizedConfig = require('./config/optimizedConfig')
const Protocol = require('../Protocol.class')

/** Adds equipment entry in equipments
 * @param {Object} equipment
 * @return {void}
 */
const add = (equipment, equipments) => {
  equipments[equipment.equipmentId] = {
    socket: new net.Socket(),
    host: equipment.Modbus.host,
    port: equipment.Modbus.port,
    connected: false,
  }
  equipments[equipment.equipmentId].client = new jsmodbus.client.TCP(equipments[equipment.equipmentId].socket)
}

/**
 * Gives a type to a point based on the config
 */
const giveType = (point) => {
  global.fTbusConfig.engine.types.forEach((typeCompared) => {
    if (typeCompared.type === point.pointId.split('.').slice(-1).pop()) {
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
  constructor({ equipments, south }, engine) {
    super(engine)
    this.optimizedConfig = optimizedConfig(equipments, south.modbus.addressGap)
    equipments.forEach((equipment) => {
      if (equipment.Modbus) {
        add(equipment, this.equipments)
      }
    })
  }

  /**
   * Runs right instructions based on a given scanMode
   * @param {String} scanMode : cron time
   * @return {void}
   */
  onScan(scanMode) {
    const scanGroup = this.optimizedConfig[scanMode]
    Object.keys(scanGroup).forEach((equipment) => {
      if (this.equipments[equipment].connected) {
        Object.keys(scanGroup[equipment]).forEach((type) => {
          const addressesForType = scanGroup[equipment][type] // Addresses of the group
          // Build function name, IMPORTANT: type must be singular
          const funcName = `read${`${type.charAt(0).toUpperCase()}${type.slice(1)}`}s`
          // Dynamic call of the appropriate function based on type
          Object.entries(addressesForType).forEach(([range, points]) => {
            points.forEach(point => giveType(point))
            const rangeAddresses = range.split('-')
            const startAddress = parseInt(rangeAddresses[0], 10) // First address of the group
            const endAddress = parseInt(rangeAddresses[1], 10) // Last address of the group
            const rangeSize = endAddress - startAddress // Size of the addresses group
            this.modbusFunction(funcName, { startAddress, rangeSize }, equipment, points)
          })
        })
      }
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
          const value = {
            pointId: point.pointId,
            timestamp,
            dataId: point.dataId,
          }
          value[point.dataId] = data
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
    Object.values(this.equipments).forEach((equipment) => {
      const { host, port } = equipment

      equipment.socket.connect(
        { host, port },
        () => {
          equipment.connected = true
        },
      )
      equipment.socket.on('error', (err) => {
        console.error(err)
      })
    })
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    Object.values(this.equipments).forEach((equipment) => {
      if (equipment.connected) {
        equipment.socket.end()
        equipment.connected = false
      }
    })
  }
}

module.exports = Modbus
