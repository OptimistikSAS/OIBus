const Queue = require('../engine/Queue.class')

class ApiHandler {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(api, engine) {
    this.queue = new Queue()
    this.application = api
    this.engine = engine
    this.config = this.engine.config
    // initialize the scanMode object with empty arrays
    this.scanModes = {}
    this.config.engine.scanModes.forEach(({ scanMode }) => {
      this.scanModes[scanMode] = []
    })
    this.config.south.equipments.forEach((equipment) => {
      if (equipment.defaultScanMode) {
        const scanMode = equipment.defaultScanMode
        if (this.scanModes[scanMode] && !this.scanModes[scanMode].includes(equipment.equipmentId)) {
          this.scanModes[scanMode].push(equipment.equipmentId)
        }
      }
    })
  }

  enqueue(value) {
    this.queue.enqueue(value)
  }

  connect() {
    console.info('connect', this.queue.length)
  }

  disconnect() {
    console.info('disconnect', this.queue.length)
  }

  onScan() {
    console.info('onScan', this.queue.length)
  }
}

module.exports = ApiHandler
