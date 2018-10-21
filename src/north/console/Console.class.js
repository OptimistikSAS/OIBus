const { sprintf } = require('sprintf-js')
const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Shows the length of this.queue
   * @return {void}
   */
  onUpdate() {
    console.info(this.queue.flush())
  }

  /**
   * Deletes the first entry in the buffer and shows it
   * Then shows the remaining buffer Array
   * @return {void}
   */
  showAndDelete() {
    if (this.queue.length > 0) {
      console.info(sprintf(this.applicationParameters.Console.content, this.queue.dequeue()))
    }
    console.info(this.queue.buffer)
  }
}

module.exports = Console
