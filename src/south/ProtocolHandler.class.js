/**
 * Class Protocol : provides general attributes and methods for protocols.
 */
class ProtocolHandler {
  /**
   * Constructor for Protocol
   * @constructor
   * @param {*} equipment - The equipment
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(equipment, engine) {
    this.equipment = equipment
    this.engine = engine
    this.logger = engine.logger
  }

  connect() {
    const { equipmentId, protocol } = this.equipment
    this.logger.warn(`equipement ${equipmentId} started with protocol ${protocol}`)
  }
  /* eslint-disable-next-line */
  onScan() {}
  /* eslint-disable-next-line */
  listen() {}
}

module.exports = ProtocolHandler
