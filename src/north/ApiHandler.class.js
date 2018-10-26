const Queue = require('../engine/Queue.class')

class ApiHandler {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(applicationParameters, engine) {
    this.queue = new Queue()
    this.application = applicationParameters
    this.engine = engine
    this.config = this.engine.config
    this.scanModes = this.engine.scanModes
  }

  /**
   * method called by Engine to get the stats of the poinId passed
   * @param {*} pointId
   * @memberof ApiHandler
   */
  get(pointId) {
    console.info('Get the stats of ', pointId, 'from ', this.application.api)
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
