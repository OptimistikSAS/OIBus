class ApiHandler {
  /**
   * @constructor for Application
   * @param {Object} engine
   */
  constructor(applicationParameters, engine) {
    this.application = applicationParameters
    this.engine = engine
    this.logger = engine.logger
    this.config = this.engine.config
    this.scanModes = this.engine.scanModes
    this.engine.register('addValue', this.onUpdate.bind(this))
  }

  /**
   * method called by Engine to get the stats of the poinId passed
   * @param {*} pointId
   * @memberof ApiHandler
   */
  get(pointId) {
    this.engine.logger.info('Get the stats of ', pointId, 'from ', this.application.api)
  }

  /**
   * method called by Engine to initialize a given api. It needs to be surcharged.
   * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  connect() {
    this.engine.logger.info('connect')
  }

  /**
   * method called by Engine to stop a given api. It needs to be surcharged.
   * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  disconnect() {
    this.engine.logger.info('disconnect')
  }

  /**
   * method to push a Value to equipments. (used for simulation at this point)
   * @param {*} value is a value object i.e { timestamp:... , field1:... , field2: ... }
   */
  /* eslint-disable-next-line */
  sendValue(value) {
    this.engine.logger.info('sendValue', value)
  }

  /**
   * method called by Engine when the value is received and when we need to update the log/database. Surcharge is needed in order
   * to send to the db, send to an external application etc...
   */
  onUpdate() {
    this.engine.logger.info('onUpdate')
  }
}

module.exports = ApiHandler
