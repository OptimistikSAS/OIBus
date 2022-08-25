const fs = require('node:fs/promises')

const NorthConnector = require('../NorthConnector.class')

/**
 * Class Console - display values and file path into the console
 */
class Console extends NorthConnector {
  static category = 'Debug'

  /**
   * Constructor for Console
   * @constructor
   * @param {Object} settings - The North connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine)
    this.canHandleValues = true
    this.canHandleFiles = true

    const { verbose } = settings.Console
    this.verbose = verbose
  }

  /**
   * Handle values by printing them to the console.
   * @param {Object[]} values - The values
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    if (this.verbose) {
      console.table(values, ['pointId', 'timestamp', 'data'])
    } else {
      process.stdout.write(`North Console sent ${values.length} values.\r\n`)
    }
  }

  /**
   * Handle the file by displaying its name in the console
   * @param {String} filePath - The path of the file
   * @returns {Promise<void>} - The result promise
   */
  async handleFile(filePath) {
    if (this.verbose) {
      const stats = await fs.stat(filePath)
      const fileSize = stats.size
      const data = [{
        filePath,
        fileSize,
      }]
      console.table(data)
    } else {
      process.stdout.write('North Console sent 1 file.\r\n')
    }
  }
}

module.exports = Console
