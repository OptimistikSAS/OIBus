const { NorthHandler } = global
/* to make this work, add into oibus.json (in north.applications)
{
  "id": "testId",
  "name": "estNorth",
  "api": "TestNorth",
  "enabled": true,
  "TestNorth": {
  },
  "caching": {
      "sendInterval": 10000,
      "retryInterval": 5000,
      "groupCount": 1000,
      "maxSendCount": 10000
  },
  "subscribedTo": [],
  "logParameters": {
      "lokiLevel": "engine",
      "consoleLevel": "engine",
      "fileLevel": "engine",
      "sqliteLevel": "engine"
  }
}
*/

class TestNorth extends NorthHandler {
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
  }

  connect() {
    super.connect()
    this.logger.info('TestNorth connect')
  }

  disconnect() {
    super.disconnect()
    this.logger.info('testNorth connect')
  }

  /**
   * Handle values by printing them to the console.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  handleValues(values) {
    this.logger.info('testNorth handleValues')
    return values.length
  }

  /**
   * Handle the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The send status
   */
  /* eslint-disable-next-line class-methods-use-this */
  async handleFile(_filePath) {
    this.logger.info('testNorth handleFile')
    return NorthHandler.STATUS.SUCCESS
  }
}

module.exports = TestNorth
