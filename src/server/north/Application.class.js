const Queue = require('../engine/Queue.class')

class Application {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(engine, applicationParameters) {
    this.queue = new Queue(engine)
    this.applicationParameters = applicationParameters
  }

  /*
  Since every distinct application has a different use for their queue,
  their prototype methods is only a display of the queue's info
  with the name of the method called.
  */

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
