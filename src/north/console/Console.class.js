const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.engine.bus.on('addValue', ({ pointId, data, timestamp }) => {
      this.onUpdate({ pointId, data, timestamp })
    })
  }

  onUpdate({ pointId, data, timestamp }) {
    this.engine.logger.info(JSON.stringify({ pointId, data, timestamp }))
  }
  // /**
  //  * Shows the length of this.queue
  //  * @return {void}
  //  * @todo Use sprintf to manage the content parameter
  //  */
  // onUpdate() {
  //   console.info(this.queue.flush())
  // }
}

module.exports = Console
