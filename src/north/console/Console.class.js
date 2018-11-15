const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Print to the console the value received
   * @param {*} value
   * @memberof Console
   */
  onUpdate(value) {
    this.engine.logger.info(JSON.stringify(value))
  }
}

module.exports = Console
