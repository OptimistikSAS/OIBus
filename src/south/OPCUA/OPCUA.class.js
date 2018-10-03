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

const typeFromPointId = (pointId) => {
  const type = pointId.split('.').slice(-1).pop()
  return type
}

const giveType = (point) => {
  global.fTbusConfig.engine.types.forEach((typeCompared) => {
    if (typeCompared.type === point.pointId.split('.').slice(-1).pop()) {
      point.type = []
      typeCompared.fields.forEach((field) => {
        point.type.push(field.type)
      })
    }
  }
}
      point.type = typeCompared.fields[0].type
      point.dataId = typeCompared.fields[0].name
      if (typeCompared.fields.length > 1) {
        console.error('Modbus points cannot contain more than 1 field')
      }
    }
  })
}

// const fieldFromPointId =

/**
 *
 *
 * @class OPCUA
 * @extends {Protocol}
 */
class OPCUA extends Protocol {
  constructor({ equipments, south }, engine) {
    super(engine)
    this.optimizedConfig = optimizedConfig(equipments)
    equipments.forEach((equipment) => {
      if (equipment.OPCUA) {
        add(south.opcua, equipment, this.equipments)
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
    // On scan : read nodes
    const scanGroup = this.optimizedConfig[scanMode]
    Object.keys(scanGroup).forEach((equipment) => {
      console.log('izi')
      if (this.equipments[equipment].connected) {
        const nodesToRead = {}
        const MAX_AGE = 10
        scanGroup[equipment].forEach((point) => {
          console.log(point)
          nodesToRead[point.pointId] = { nodeId: sprintf('ns=%(ns)s;s=%(s)s', point.OPCUAnodeId) }
        })
        this.equipments[equipment].session.read(Object.values(nodesToRead), MAX_AGE, (err, dataValues) => {
          if (!err && Object.keys(nodesToRead).length === dataValues.length) {
            console.log(nodesToRead)
            Object.keys(nodesToRead).forEach((pointId) => {
              const dataValue = dataValues.shift()
              const value = {
                pointId,
                timestamp: dataValue.sourceTimestamp.toString(),
              }
              const type = typeFromPointId(pointId)
              global.fTbusConfig.engine.types.forEach((typeCompared) => {
                if (type === typeCompared.type) {
                  typeCompared.fields.forEach((field) => {
                    value[field.name] = dataValue.value[field.name]
                  })
                }
              })
              this.engine.addValue(value)
            })
          }
        })
      }
    })
  }
}

module.exports = OPCUA
