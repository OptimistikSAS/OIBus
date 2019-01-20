const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Print to the console the value received
   * @param {Array} values - The values
   * @memberof Console
   * @return {void}
   */
  /* eslint-disable-next-line class-methods-use-this */
  onUpdate(values) {
    values.forEach((value) => {
      console.info(value)
    })
  }
}

module.exports = Console
