const Opcua = require('node-opcua')
const { sprintf } = require('sprintf-js')
const Protocol = require('../Protocol.class')
const optimizedConfig = require('./config/optimizedConfig')

const add = (opcua, equipment, equipments) => {
  equipments[equipment.equipmentId] = {
    client: new Opcua.OPCUAClient({ endpoint_must_exist: false }),
    url: sprintf(opcua.connectionAddress.opc, equipment.OPCUA),
  }
}

const giveTypes = (point) => {
  global.fTbusConfig.engine.types.forEach((typeCompared) => {
    if (typeCompared.type === point.pointId.split('.').slice(-1).pop()) {
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
  console.error('Unable to retrieve fields associated with this pointId : ', pointId)
  console.log(scannedEquipment)
  return {}
}

/**
 *
 *
 * @class OPCUA
 * @extends {Protocol}
 */
class OPCUA extends Protocol {
  constructor(equipment, south) {
    super(south)
    this.optimizedConfig = optimizedConfig(equipments)
    this.equipments.forEach((equipment) => {
      if (equipment.OPCUA) {
        add(south.OPCUA, equipment, this.equipments)
      }
    })
  }

  async connect() {
    await Object.values(this.equipments).forEach(async (equipment) => {
      await equipment.client.connect(equipment.url)
      await equipment.client.createSession((err, session) => {
        if (!err) {
          equipment.session = session
          equipment.connected = true
        }
      })
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
      console.log('dddd')
      if (this.equipments[equipment].connected) {
        const nodesToRead = {}
        const MAX_AGE = 10
        scanGroup[equipment].forEach((point) => {
          nodesToRead[point.pointId] = { nodeId: sprintf('ns=%(ns)s;s=%(s)s', point.OPCUAnodeId) }
        })
        this.equipments[equipment].session.read(Object.values(nodesToRead), MAX_AGE, (err, dataValues) => {
          if (!err && Object.keys(nodesToRead).length === dataValues.length) {
            console.log(dataValues)
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
                  value.data[field.name] = dataValue.value.value// .shift() // Assuming the values array would under dataValue.value.value
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
