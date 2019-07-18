const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * Constructor for Console
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.canHandleValues = true
  }

  /**
   * Handle values by printing them to the console.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  /* eslint-disable-next-line class-methods-use-this */
  async handleValues(values) {
    console.table(values, ['pointId', 'timestamp', 'data'])
    return true
  }
}

Console.schema = require('./schema')

module.exports = Console
