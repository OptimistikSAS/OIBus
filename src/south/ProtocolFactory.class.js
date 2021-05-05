const protocolList = {}
protocolList.Modbus = require('./Modbus/Modbus.class')
protocolList.OPCUA_HA = require('./OPCUA_HA/OPCUA_HA.class')
protocolList.OPCUA_DA = require('./OPCUA_DA/OPCUA_DA.class')
protocolList.MQTT = require('./MQTT/MQTT.class')
protocolList.SQLDbToFile = require('./SQLDbToFile/SQLDbToFile.class')
protocolList.FolderScanner = require('./FolderScanner/FolderScanner.class')
protocolList.OPCHDA = require('./OPCHDA/OPCHDA.class')

/**
 * Class ProtocolFactory: to instantiate new South instance
 */
class ProtocolFactory {
  /**
   * Return new South instance
   *
   * @param {string} protocol - The protocol
   * @param {object} dataSource - The data source
   * @param {BaseEngine} engine - The engine
   * @returns {ProtocolHandler|null} - The South
   */
  static create(protocol, dataSource, engine) {
    const SouthHandler = protocolList[protocol]
    if (SouthHandler) {
      return new SouthHandler(dataSource, engine)
    }
    return null
  }

  /**
   * Return available South protocols
   * @return {String[]} - Available South protocols
   */
  static getSouthList() {
    return Object.keys(protocolList)
  }
}

module.exports = ProtocolFactory
