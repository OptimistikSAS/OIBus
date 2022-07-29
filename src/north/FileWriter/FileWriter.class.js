const fs = require('fs/promises')
const path = require('path')

const { NorthHandler } = global

class FileWriter extends NorthHandler {
  static category = 'FileIn'

  /**
   * Constructor for FileWriter
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.outputFolder = path.resolve(applicationParameters.FileWriter.outputFolder)
    this.prefixFileName = applicationParameters.FileWriter.prefixFileName ?? ''
    this.suffixFileName = applicationParameters.FileWriter.suffixFileName ?? ''
  }

  /**
   * Handle values by writing them to a file.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.debug(`FileWriter handleValues() with ${values.length} values`)
    const fileName = `${this.prefixFileName}${new Date().getTime()}${this.suffixFileName}.json`
    const cleanedValues = values.map((value) => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId,
    }))
    const data = JSON.stringify(cleanedValues)
    try {
      await fs.writeFile(path.join(this.outputFolder, fileName), data)
      this.logger.debug(`FileWriter ${fileName} created in "${this.outputFolder}"`)
      this.statusData['Last handled values at'] = new Date().toISOString()
      this.statusData['Number of values sent since OIBus has started'] += values.length
      this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${values[values.length - 1].data.value})`
      this.updateStatusDataStream()
      return values.length
    } catch (error) {
      this.logger.error(`Error handling values: ${error}`)
      return NorthHandler.STATUS.LOGIC_ERROR
    }
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    try {
      const stats = await fs.stat(filePath)
      this.logger.debug(`handleFile(${filePath}) (${stats.size} bytes)`)
      const extension = path.extname(filePath)
      let fileName = path.basename(filePath, extension)
      fileName = `${this.prefixFileName}${fileName}${this.suffixFileName}${extension}`
      await fs.copyFile(filePath, path.join(this.outputFolder, fileName))
      this.logger.debug(`FileWriter copied file ${fileName}`)
      this.statusData['Last uploaded file'] = filePath
      this.statusData['Number of files sent since OIBus has started'] += 1
      this.statusData['Last upload at'] = new Date().toISOString()
      this.updateStatusDataStream()
      return NorthHandler.STATUS.SUCCESS
    } catch (error) {
      this.logger.error(`Error handling file, ${error}`)
      return NorthHandler.STATUS.LOGIC_ERROR
    }
  }
}
FileWriter.schema = require('./FileWriter.schema')

module.exports = FileWriter
