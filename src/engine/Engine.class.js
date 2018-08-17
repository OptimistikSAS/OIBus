const { CronJob } = require('cron')
const Modbus = require('../south/Modbus/Modbus.class')
const Console = require('../north/console/Console.class')

const protocolList = { Modbus }

const applicationList = {
  Console,
  // InfluxDB
}
// manage la responses de toutes les app
const activeProtocols = {}
const activeApplications = {}


/**
 * Class ResponsesHandler : allows to manage requests responses in a Map
 */
class Engine {
  /**
   * Constructor for the class ResponsesHandler
   */
  constructor() {
    this.queue = []
  }

  /**
   * Fills the map with as many Arrays as there are pointId's in the config file
   * With the pointId as a key.
   * @return {void}
   */

  /**
   * Updates the responses map
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @param {Function} callback : callback function
   * @return {void}
   */

  addValue({ pointId, timestamp, data }, callback) {
    this.queue.forEach((queue) => {
      queue.enqueue({ pointId, timestamp, data })
      queue.info()
    })
    if (callback) callback(this.queue[0].buffer)
  }

  remove({ pointId, timestamp }, queue, callback) {
    console.log(this.queue[queue][pointId].remove(timestamp))
    if (callback) callback() // Alerte unique dans le callback ?
  }

  info() {
    return { queues: this.queue.length }
  }

  registerQueue(queue) {
    this.queue.push(queue)
  }


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
      if (!activeApplications[type] && type !== 'InfluxDB') {
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

  // Quand la map est mise à jour un évènement est créé pour toutes les applications
  // Quand remove seule 1 app (celle qui remove) est alertée
}

module.exports = Engine
