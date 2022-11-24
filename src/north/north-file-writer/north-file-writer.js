const fs = require('node:fs/promises')
const path = require('node:path')

const NorthConnector = require('../north-connector')

/**
 * Class NorthFileWriter - Write file in an output folder. Values are stored in JSON files
 */
class NorthFileWriter extends NorthConnector {
  static category = 'FileIn'

  /**
   * Constructor for NorthFileWriter
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {Object[]} proxies - The list of available proxies
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxies,
    logger,
  ) {
    super(
      configuration,
      proxies,
      logger,
    )
    this.canHandleValues = true
    this.canHandleFiles = true

    const { outputFolder, prefixFileName, suffixFileName } = configuration.settings
    this.outputFolder = path.resolve(outputFolder)
    this.prefixFileName = prefixFileName
    this.suffixFileName = suffixFileName
  }

  /**
   * Handle values by writing them to a file.
   * @param {Object[]} values - The values
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    this.logger.debug(`Handle ${values.length} values.`)
    const fileName = `${this.prefixFileName}${new Date().getTime()}${this.suffixFileName}.json`
    const cleanedValues = values.map((value) => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId,
    }))
    const data = JSON.stringify(cleanedValues)

    await fs.writeFile(path.join(this.outputFolder, fileName), data)
    this.logger.debug(`File "${fileName}" created in "${this.outputFolder}" output folder.`)
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @returns {Promise<void>} - The result promise
   */
  async handleFile(filePath) {
    const stats = await fs.stat(filePath)
    this.logger.debug(`Handle file "${filePath}" (${stats.size} bytes).`)
    const extension = path.extname(filePath)
    let fileName = path.basename(filePath, extension)
    fileName = `${this.prefixFileName}${fileName}${this.suffixFileName}${extension}`
    await fs.copyFile(filePath, path.join(this.outputFolder, fileName))
    this.logger.debug(`File "${filePath}" copied into "${fileName}".`)
  }
}

module.exports = NorthFileWriter
