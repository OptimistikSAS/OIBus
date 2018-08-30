const { sprintf } = require('sprintf-js')
const Application = require('../Application.class')

class Console extends Application {
  /**
   * Shows info on this.queue (currently, only the buffer length)
   * @return {void}
   */
  onScan() {
    console.info(this.queue.info())
  }

  /**
   * Deletes the first entry in the buffer and shows it
   * Then shows the remaining buffer Array
   * @return {void}
   */
  showAndDelete() {
    if (this.queue.info().length > 0) {
      console.log(sprintf(global.fTbusConfig.applications[0].Console.content, this.queue.dequeue()))
    }
    console.log(this.queue.buffer)
  }

  /** Empties the buffer
   * @return {void}
   */
  deleteAll() {
    while (this.queue.info().length > 0) {
      this.queue.dequeue()
    }
  }
}

module.exports = Console
