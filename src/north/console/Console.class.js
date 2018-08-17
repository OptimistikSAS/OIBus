const Application = require('../Application.class')

class Console extends Application {
  onScan() {
    // console.info(this.queue.info())
    this.showAndDelete()
  }

  /**
   * A method for testing the interactions with the Queue class
   * Deletes the first entry in the buffer and shows it
   * Then shows the remaining buffer Array
   */
  showAndDelete() {
    if (this.queue.info().length > 0) {
      console.log(this.queue.dequeue())
    }
    console.log(this.queue.buffer)
  }
}

module.exports = Console
