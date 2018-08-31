const Queue = require('../engine/Queue.class')

class Application {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(engine) {
    this.queue = new Queue(engine)
  }

  /*
  Since every distinct application has a set use for their queue,
  their prototype methods is only a display of the queue's info
  with the name of the method called.
  */

  connect() {
    console.info('connect', this.queue.info())
  }

  disconnect() {
    console.info('disconnect', this.queue.info())
  }

  onScan() {
    console.info('onScan', this.queue.info())
  }
}

module.exports = Application
