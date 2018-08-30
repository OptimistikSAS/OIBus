const { CronJob } = require('cron')
const Modbus = require('../south/Modbus/Modbus.class')
const Console = require('../north/console/Console.class')
const InfluxDB = require('../north/influxdb/InfluxDB.class')
const { tryReadFile } = require('../services/config.service')

const protocolList = { Modbus }

const applicationList = {
  Console,
  InfluxDB,
}
const activeProtocols = {}
const activeApplications = {}


/**
 * Class Engine :
 * - at startup, handles initialization of applications, protocols and config.
 * - allows to manage the queues for every protocol and application.
 */
class Engine {
  /**
   * Constructor for the class Engine
   */
  constructor() {
    this.queues = []
  }

  /**
   * Updates every queue with a new entry
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @return {void}
   */
  addValue({ pointId, timestamp, data }) {
    this.queues.forEach((queue) => {
      queue.enqueue({ pointId, timestamp, data })
      // queue.info()
    })
  }

  /**
   * Unused
   * Provides basic information about queues
   * @return {Object} : { queues: number of registered queues }
   */
  info() {
    return { queues: this.queues.length }
  }

  /**
   * Registers a new queue in the list
   * @param {Object} queue : the Queue Object to be added
   * @return {void}
   */
  registerQueue(queue) {
    this.queues.push(queue)
  }

  /**
   * Creates a new instance for every application and protocol.
   * @param {String} config : the config Object
   * @param {*} callback
   * @return {void}
   */
  start(config, callback) {
    // adds every protocol and application to be used in activeProtocols and activeApplications
    Object.values(config.equipments).forEach((equipment) => {
      const { protocol } = equipment
      if (!activeProtocols[protocol]) {
        activeProtocols[protocol] = new protocolList[protocol](config, this)
        //
      }
    })
    Object.values(config.applications).forEach((application) => {
      const { type } = application
      if (!activeApplications[type]) {
        activeApplications[type] = new applicationList[type](this)
        //
      }
    })
    Object.keys(activeProtocols).forEach(protocol => activeProtocols[protocol].connect())
    Object.keys(activeApplications).forEach(application => activeApplications[application].connect())
    config.scanModes.forEach(({ scanMode, cronTime }) => {
      const job = new CronJob({
        cronTime,
        onTick: () => {
          Object.keys(activeProtocols).forEach(protocol => activeProtocols[protocol].onScan(scanMode))
          Object.keys(activeApplications).forEach(application => activeApplications[application].onScan(scanMode))
        },
        start: false,
      })
      job.start()
    })
    if (callback) callback()
  }

  /**
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * @param {String} config : path to the config file
   * @return {Object} readConfig : parsed config Object
   */
  static initConfig(config) {
    const readConfig = tryReadFile(config)
    readConfig.equipments.forEach((equipment) => {
      equipment.points.forEach((point) => {
        if (point.pointId.charAt(0) === '.') {
          point.pointId = equipment.pointIdRoot + point.pointId.slice(1)
        }
      })
    })
    if (!readConfig.scanModes) {
      console.error('You should define scan modes.')
      throw new Error('You should define scan modes.')
    }
    if (!readConfig.equipments) {
      console.error('You should define equipments.')
      throw new Error('You should define equipments.')
    }
    return readConfig
  }
}

module.exports = Engine
