/**
 * Class Protocol : provides general attributes and methods for protocols.
 */
class ProtocolHandler {
  /**
   * @constructor for Protocol
   * @param {Object} engine
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
