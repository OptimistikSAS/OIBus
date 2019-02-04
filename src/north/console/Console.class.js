const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Handle values by printing them to the console.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  /* eslint-disable-next-line class-methods-use-this */
  handleValues(values) {
    values.forEach((value) => {
      console.info(value)
    })

    return Promise.resolve()
  }
}

module.exports = Console
