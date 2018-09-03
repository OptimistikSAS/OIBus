const { sprintf } = require('sprintf-js')
const Application = require('../Application.class')

class Console extends Application {
  /**
   * Shows the length of this.queue
   * @return {void}
   */
  onScan() {
    console.info(this.queue.length)
    this.deleteAll()
  }

  /**
   * Deletes the first entry in the buffer and shows it
   * Then shows the remaining buffer Array
   * @return {void}
   */
  showAndDelete() {
    if (this.queue.length > 0) {
      console.log(sprintf(global.fTbusConfig.applications[0].Console.content, this.queue.dequeue()))
    }
    console.log(this.queue.buffer)
  }

  /** Empties the buffer
   * @return {void}
   */
  deleteAll() {
    console.log(this.queue.flush())
  }
}

module.exports = Console
