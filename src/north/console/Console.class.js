const ApiHandler = require('../ApiHandler.class')

class Console extends ApiHandler {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.start()
  }

  /**
   * This will permit the apllication to start listening all the necessary events
   * @memberof InfluxDB
   */
  start() {
    this.engine.bus.on('addValue', (value) => {
      this.onUpdate(value)
    })
  }

  onUpdate(value) {
    this.engine.logger.info(JSON.stringify(value))
  }
}

module.exports = Console
