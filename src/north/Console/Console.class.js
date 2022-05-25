const fs = require('fs/promises')

const ApiHandler = require('../ApiHandler.class')
const MainCache = require('../../engine/cache/MainCache.class')

class Console extends ApiHandler {
  static category = 'Debug'

  /**
   * Constructor for Console
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
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
    } else {
      process.stdout.write(`(${values.length})`)
    }
    this.updateStatusDataStream({
      'Last handled values at': new Date().toISOString(),
      'Number of values sent since OIBus has started': this.statusData['Number of values sent since OIBus has started'] + values.length,
      'Last added point id (value)': `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`,
    })
    return values.length
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The status sent
   */
  async handleFile(filePath) {
    const stats = await fs.stat(filePath)
    const fileSize = stats.size
    const data = [{
      filePath,
      fileSize,
    }]
    console.table(data)
    this.updateStatusDataStream({
      'Last uploaded file': filePath,
      'Number of files sent since OIBus has started': this.statusData['Number of files sent since OIBus has started'] + 1,
      'Last upload at': new Date().toISOString(),
    })
    return ApiHandler.STATUS.SUCCESS
  }
}

module.exports = Console
