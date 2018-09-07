const Opcua = require('node-opcua')
const { sprintf } = require('sprintf-js')
const Protocol = require('../Protocol.class')

class OPCUA extends Protocol {
  constructor({ equipments, opcua }, engine) {
    super(engine)
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
      url: sprintf(opcua.connectionAddress.opc, equipment.OPCUA)
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

  async onScan() {
    // On scan : read nodes
    /** @todo check if every async and await is useful */
    /** @todo on the very first Scan equipment.session might not be created yet, find out why */
    /** @todo nodesToRead should be declared for each read */
    const nodesToRead = {
      nodeId: 'ns=5;s=Counter1',
      // attributeId: AttributeIds.BrowseName
    }
    Object.values(this.equipments).forEach((equipment) => {
      equipment.session.read(nodesToRead, (err, dataValue) => {
        if (!err) {
          console.log(dataValue.value.toString())
        }
      })
    })
  }
}

module.exports = OPCUA
