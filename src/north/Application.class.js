const Queue = require('../engine/Queue.class')

class Application {
  constructor(engine) {
    this.queue = new Queue(engine)
  }

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
