/**
 * Buffer implementation to group multiple south events into a single north update.
 */
class Buffer {
  /**
   * Constructor for Buffer
   * @constructor
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(engine) {
    this.engine = engine
    this.logger = engine.logger
    this.config = this.engine.config.engine.grouping
  }
}

module.exports = Buffer
