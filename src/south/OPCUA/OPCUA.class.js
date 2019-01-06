const Opcua = require('node-opcua')
const { sprintf } = require('sprintf-js')
const ProtocolHandler = require('../ProtocolHandler.class')
const getOptimizedConfig = require('./config/getOptimizedConfig')

/**
 * Returns the fields array from the point containing passed pointId.
 * The point is from the optimized config hence the scannedEquipment parameter
 * @param {Object} pointId - The point ID
 * @param {Array} types - The types
 * @param {Logger} logger - The logger
 * @return {*} The fields
 */
const fieldsFromPointId = (pointId, types, logger) => {
  const type = types.find(
    typeCompared => typeCompared.type
      === pointId
        .split('.')
        .slice(-1)
        .pop(),
  )
  const { fields = [] } = type
  if (fields) {
    return fields
  }
  logger.error('Unable to retrieve fields associated with this pointId ', pointId, types)
  return {}
}

/**
 *
 *
 * @class OPCUA
 * @extends {ProtocolHandler}
 */
class OPCUA extends ProtocolHandler {
  /**
   * Constructor for OPCUA
   * @constructor
   * @param {Object} equipment - The equipment
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(equipment, engine) {
    super(equipment, engine)
    // as OPCUA can group multiple points in a single request
    // we group points based on scanMode
    this.optimizedConfig = getOptimizedConfig(equipment)
    // define OPCUA connection parameters
    this.client = new Opcua.OPCUAClient({ endpoint_must_exist: false })
    this.url = sprintf('opc.tcp://%(host)s:%(opcuaPort)s/%(endPoint)s', equipment.OPCUA)
    this.maxAge = equipment.OPCUA.maxAge || 10
  }

  /**
   * Connect.
   * @return {Promise<void>} The connection promise
   */
  async connect() {
    await this.client.connect(
      this.url,
      (err1) => {
        if (!err1) {
          this.logger.log('OPCUA Connected')
          this.client.createSession((err2, session) => {
            if (!err2) {
              this.session = session
              this.connected = true
            } else {
              this.logger.error('Could not connect to : ', this.equipment.equipmentId)
            }
          })
        } else {
          this.logger.error(err1)
        }
      },
    )
  }

  /**
   * On scan.
   * @param {String} scanMode - The scan mode
   * @return {Promise<void>} - The on scan promise
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
          this.logger.debug(pointId, scanGroup)
          this.logger.debug(fieldsFromPointId(pointId, this.engine.config.engine.types, this.logger))
          fieldsFromPointId(pointId, this.engine.config.engine.types, this.logger).forEach((field) => {
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
        this.logger.error(err)
      }
    })
  }
}

module.exports = OPCUA
