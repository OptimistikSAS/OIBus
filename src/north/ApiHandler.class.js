class ApiHandler {
  /**
   * Constructor for Application
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    this.application = applicationParameters
    this.engine = engine
    this.logger = engine.logger
    this.config = this.engine.config
    this.scanModes = this.engine.scanModes
    this.engine.register('addValues', this.onUpdate.bind(this))
  }

  /**
   * Method called by Engine to get the stats of the poinId passed
   * @param {*} pointId - The point ID
   * @memberof ApiHandler
   * @return {void}
   */
  get(pointId) {
    this.engine.logger.info('Get the stats of ', pointId, 'from ', this.application.api)
  }

  /**
   * Method called by Engine to initialize a given api. It needs to be surcharged.
   * @return {void}
   */
  connect() {
    this.engine.logger.info('connect')
  }

  /**
   * Method called by Engine to stop a given api. It needs to be surcharged.
   * @return {void}
   */
  disconnect() {
    this.engine.logger.info('disconnect')
  }

  /**
   * Method to push a Value to equipments. (used for simulation at this point)
   * @param {Object} value - Is a value object i.e { timestamp:... , field1:... , field2: ... }
   * @return {void}
   */
  sendValue(value) {
    this.engine.logger.info('sendValue', value)
  }

  /**
   * Method called by Engine when the value is received and when we need to update the log/database. Surcharge is needed in order
   * to send to the db, send to an external application etc...
   * @param {Object} value - Is a value object i.e { timestamp:... , field1:... , field2: ... }
   * @return {void}
   */
  /* eslint-disable-next-line no-unused-vars */
  onUpdate(value) {
    this.engine.logger.info('onUpdate')
  }
}

module.exports = ApiHandler
