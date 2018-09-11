const Opcua = require('node-opcua')
const { sprintf } = require('sprintf-js')
const Protocol = require('../Protocol.class')
const optimizedConfig = require('../config/optimizedConfig').OPCUA

class OPCUA extends Protocol {
  constructor({ equipments, opcua }, engine) {
    super(engine)
    this.optimizedConfig = optimizedConfig(equipments)
    this.equipments = {}
    equipments.forEach((equipment) => {
      if (equipment.OPCUA) {
        this.add(opcua, equipment)
      }
    })
  }

  add(opcua, equipment) {
    this.equipments[equipment.equipmentId] = {
      client: new Opcua.OPCUAClient({ endpoint_must_exist: false }),
      url: sprintf(opcua.connectionAddress.opc, equipment.OPCUA),
    }
  }

  async connect() {
    this.connected = true
    await Object.values(this.equipments).forEach(async (equipment) => {
      await equipment.client.connect(equipment.url)
      await equipment.client.createSession((err, session) => {
        if (!err) {
          equipment.session = session
          console.log(this.equipments)
        } else {
          this.connected = false
        }
      })
    })
  }

  async onScan(scanMode) {
    // On scan : read nodes
    /** @todo check if every async and await is useful */
    /** @todo on the very first Scan equipment.session might not be created yet, find out why */
    /** @todo group every node to read in a nodesToRead object instead of nodeToRead */
    const scanGroup = this.optimizedConfig[scanMode]
    Object.keys(scanGroup).forEach((equipment) => {
      const nodeToRead = {
        nodeId: sprintf('ns=%(ns)s;s=%(s)s', scanGroup[equipment][0].OPCUAnodeId),
        attributeId: Opcua.AttributeIds.Value,
      }
      const timestamp = `${new Date()}`
      this.equipments[equipment].session.read(nodeToRead, (err, dataValue) => {
        if (!err) {
          this.engine.addValue({ pointId: scanGroup[equipment][0].pointId, timestamp, data: dataValue.value.value })
          // console.log(timestamp, dataValue.value.value, scanGroup[equipment][0].pointId)
        }
      })
    })
  }
}

module.exports = OPCUA
