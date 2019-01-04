const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Print to the console the value received
   * @param {Object} value - The value
   * @memberof Console
   * @return {void}
   */
  /* eslint-disable-next-line class-methods-use-this */
  onUpdate(value) {
    console.info(value)
  }
}

module.exports = Console
