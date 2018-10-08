const Opcua = require('node-opcua')
const { sprintf } = require('sprintf-js')
const ProtocolHandler = require('../ProtocolHandler.class')
const optimizedConfig = require('./config/getOptimizedConfig')

const add = (opcua, equipment, equipments) => {
  equipments[equipment.equipmentId] = {}
}

const giveTypes = (point) => {
  global.fTbusConfig.engine.types.forEach((typeCompared) => {
    if (
      typeCompared.type
      === point.pointId
        .split('.')
        .slice(-1)
        .pop()
    ) {
      point.fields = typeCompared.fields
      // point.fields.forEach((field) => {
      //   field.dataId = field.name
      //   delete field.name
      // })
    }
  })
  console.log(point)
}

/**
 * Returns the fields array from the point containing arg'd pointId.
 * The point is from the optimized config hence the scannedEquipment parameter
 * @param {*} pointId
 * @param {*} scannedEquipment
 */
const fieldsFromPointId = (pointId, scannedEquipment) => {
  scannedEquipment.forEach((point) => {
    console.log(point.pointId, pointId)
    if (point.pointId === pointId) return point.fields
  })
  console.error('Unable to retrieve fields associated with this pointId ', pointId, scannedEquipment)
  return {}
}

/**
 *
 *
 * @class OPCUA
 * @extends {Protocol}
 */
class OPCUA extends ProtocolHandler {
  constructor(equipment, engine) {
    super(equipment, engine)
    // as OPCUA can group multiple points in a single request
    // we group points based on scanMode
    this.optimizedConfig = optimizedConfig(equipment)
    // define OPCUA connection parameters
    this.client = new Opcua.OPCUAClient({ endpoint_must_exist: false })
    this.url = sprintf(engine.south.OPCUA.connectionAddress.opc, equipment.OPCUA)
    this.maxAge = equipment.OPCUA.maxAge || 10
  }

  async connect() {
    this.client.connect(this.equipment.url)
    await this.client.createSession((err, session) => {
      if (!err) {
        this.session = session
        this.connected = true
      }
    })
  }

  /**
   * @param {String} scanMode
   * @todo check if every async and await is useful
   * @todo on the very first Scan equipment.session might not be created yet, find out why
   */
  async onScan(scanMode) {
    const scanGroup = this.optimizedConfig[scanMode]
    Object.keys(scanGroup).forEach((equipment) => {
      if (this.equipments[equipment].connected) {
        const nodesToRead = {}
        scanGroup[equipment].forEach((point) => {
          nodesToRead[point.pointId] = { nodeId: sprintf('ns=%(ns)s;s=%(s)s', point.OPCUAnodeId) }
        })
        this.equipments[equipment].session.read(Object.values(nodesToRead), this.maxAge, (err, dataValues) => {
          if (!err && Object.keys(nodesToRead).length === dataValues.length) {
            Object.keys(nodesToRead).forEach((pointId) => {
              const dataValue = dataValues.shift()
              const value = {
                pointId,
                timestamp: dataValue.sourceTimestamp.toString(),
                data: {},
                // dataId: [], // to add after data{} is handled
              }
              fieldsFromPointId(pointId, scanGroup[equipment]).forEach((field) => {
                if (field.name !== 'quality') {
                  value.data[field.name] = dataValue.value.value // .shift() // Assuming the values array would under dataValue.value.value
                } else {
                  value.data[field.name] = dataValue.statusCode.value
                }
              })
              this.engine.addValue(value)
              // @todo handle double values with an array as data
            })
          } else {
            console.error(err)
          }
        })
      }
    })
  }
}

module.exports = OPCUA
