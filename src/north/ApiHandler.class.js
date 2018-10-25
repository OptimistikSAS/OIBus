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

  /**
   * method called by Engine for each active applications
   * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  enqueue(value) {
    this.queue.enqueue(value)
  }

  /**
   * method called by Engine to initialize a given api. It needs to be surcharged.
   * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  connect() {
    console.info('connect', this.queue.length)
  }

  /**
   * method called by Engine to stop a given api. It needs to be surcharged.
   * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  disconnect() {
    console.info('disconnect', this.queue.length)
  }

  /**
     * method to push a Value to equipments. (used for simulation at this point)
     * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  /* eslint-disable-next-line */
  sendValue(value) {
    console.info('sendValue', value)
  }

  /**
   * method called by Engine when a queue has been updated. Surcharge is needed in order
   * to send to the db, send to an external application etc...
  */
  onUpdate() {
    console.info('onUpdate', this.queue.length)
  }
}

module.exports = ApiHandler
