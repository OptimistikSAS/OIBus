const Queue = require('../engine/Queue.class')

class Application {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(application, applicationParameters) {
    this.queue = new Queue()
    this.applicationParameters = applicationParameters
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

module.exports = Application
