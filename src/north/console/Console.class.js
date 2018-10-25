const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Shows the length of this.queue
   * @return {void}
   * @todo Use sprintf to manage the content parameter
   */
  onUpdate() {
    console.info(this.queue.flush())
  }
}

module.exports = Console
