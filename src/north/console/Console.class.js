const { sprintf } = require('sprintf-js')
const Application = require('../Application.class')

class Console extends Application {
  /**
   * Shows the length of this.queue
   * @return {void}
   */
  onScan() {
    console.log(this.queue.flush())
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
}

module.exports = Console
