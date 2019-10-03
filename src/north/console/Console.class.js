const fs = require('fs')

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
    this.canHandleFiles = true
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

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  /* eslint-disable-next-line class-methods-use-this */
  async handleFile(filePath) {
    const stats = fs.statSync(filePath)
    const fileSize = stats.size
    const data = [{
      filePath,
      fileSize,
    }]
    console.table(data)
    return true
  }
}

module.exports = Console
