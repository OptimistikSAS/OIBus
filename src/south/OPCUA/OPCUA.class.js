const Opcua = require('node-opcua')
const { sprintf } = require('sprintf-js')
const ProtocolHandler = require('../ProtocolHandler.class')
const getOptimizedConfig = require('./config/getOptimizedConfig')


/**
 * Returns the fields array from the point containing passed pointId.
 * The point is from the optimized config hence the scannedEquipment parameter
 * @param {*} pointId
 * @param {*} scannedEquipment
 */
const fieldsFromPointId = (pointId, types) => {
  let fields = []
  types.some((typeCompared) => {
    if (
      typeCompared.type
      === pointId
        .split('.')
        .slice(-1)
        .pop()
    ) {
      fields = typeCompared.fields
      return true
    }
  })
  if (fields) {
    return fields
  }
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
    this.optimizedConfig = getOptimizedConfig(equipment)
    // define OPCUA connection parameters
    this.client = new Opcua.OPCUAClient({ endpoint_must_exist: false })
    this.url = sprintf(engine.config.south.OPCUA.connectionAddress.opc, equipment.OPCUA)
    this.maxAge = equipment.OPCUA.maxAge || 10
  }

  async connect() {
    await this.client.connect(this.url, (err1) => {
      if (!err1) {
        console.log('Connected')
        this.client.createSession((err2, session) => {
          if (!err2) {
            this.session = session
            this.connected = true
          } else {
            console.error('Could not connect to : ', this.equipment.equipmentId)
          }
        })
      } else {
        console.error(err1)
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
    if (!this.connected || !scanGroup) return
    const nodesToRead = {}
    scanGroup.forEach((point) => {
      nodesToRead[point.pointId] = { nodeId: sprintf('ns=%(ns)s;s=%(s)s', point.OPCUAnodeId) }
    })
    this.session.read(Object.values(nodesToRead), this.maxAge, (err, dataValues) => {
      if (!err && Object.keys(nodesToRead).length === dataValues.length) {
        Object.keys(nodesToRead).forEach((pointId) => {
          const dataValue = dataValues.shift()
          const value = {
            pointId,
            timestamp: dataValue.sourceTimestamp.toString(),
            data: [],
            dataId: [], // to add after data{} is handled
          }
          console.log(pointId, scanGroup)
          console.log(fieldsFromPointId(pointId, this.engine.config.engine.types))
          fieldsFromPointId(pointId, this.engine.config.engine.types).forEach((field) => {
            value.dataId.push(field.name)
            if (field.name !== 'quality') {
              value.data.push(dataValue.value.value) // .shift() // Assuming the values array would under dataValue.value.value
            } else {
              value.data.push(dataValue.statusCode.value)
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
}

module.exports = OPCUA
