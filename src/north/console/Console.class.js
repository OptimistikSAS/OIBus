const fs = require('fs')

const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  static category = 'Debug'

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
    this.verbose = applicationParameters.Console.verbose ?? false
  }

  /**
   * Handle values by printing them to the console.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    if (this.verbose) {
      console.table(values, ['pointId', 'timestamp', 'data'])
      this.statusData['Last handled Values at'] = new Date().toISOString()
      this.updateStatusDataStream()
    } else {
      process.stdout.write(`(${values.length})`)
      this.statusData['Last handled Values at'] = new Date().toISOString()
      this.updateStatusDataStream()
    }
    return values.length
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
    this.statusData['Last uploaded file'] = filePath
    this.updateStatusDataStream()
    return ApiHandler.STATUS.SUCCESS
  }
}

module.exports = Console
