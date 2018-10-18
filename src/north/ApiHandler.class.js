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
