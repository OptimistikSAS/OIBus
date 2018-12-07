const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Print to the console the value received
   * @param {*} value
   * @memberof Console
   */
  /* eslint-disable-next-line class-methods-use-this */
  onUpdate(value) {
    console.info(value)
  }
}

module.exports = Console
