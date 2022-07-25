const fs = require('fs/promises')

const { NorthHandler } = global

class Console extends NorthHandler {
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
    this.statusData['Last handled values at'] = new Date().toISOString()
    this.statusData['Number of values sent since OIBus has started'] += values.length
    this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${JSON.stringify(values[values.length - 1].data)})`
    this.updateStatusDataStream()
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
    this.statusData['Last uploaded file'] = filePath
    this.statusData['Number of files sent since OIBus has started'] += 1
    this.statusData['Last upload at'] = new Date().toISOString()
    this.updateStatusDataStream()
    return NorthHandler.STATUS.SUCCESS
  }
}
Console.schema = require('./Console.schema')

module.exports = Console
