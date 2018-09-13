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


/**
 *
 *
 * @class OPCUA
 * @extends {Protocol}
 */
class OPCUA extends Protocol {
  constructor({ equipments, opcua }, engine) {
    super(engine)
    this.optimizedConfig = optimizedConfig(equipments)
    this.equipments = {}
    equipments.forEach((equipment) => {
      if (equipment.OPCUA) {
        add(opcua, equipment, this.equipments)
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
      if (this.equipments[equipment].connected) {
        const nodesToRead = {}
        scanGroup[equipment].forEach((point) => {
          nodesToRead[point.pointId] = { nodeId: sprintf('ns=%(ns)s;s=%(s)s', point.OPCUAnodeId) }
        })
        this.equipments[equipment].session.read(Object.values(nodesToRead), 10, (err, dataValues) => {
          if (!err && Object.keys(nodesToRead).length === dataValues.length) {
            Object.keys(nodesToRead).forEach((pointId) => {
              const dataValue = dataValues.shift()
              this.engine.addValue({
                pointId,
                timestamp: dataValue.sourceTimestamp.toString(),
                data: dataValue.value.value,
              })
            })
          }
        })
      }
    })
  }
}

module.exports = OPCUA
