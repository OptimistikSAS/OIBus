/**
 * Parent class used for values and files cache
 */
class BaseCache {
  /**
   * @param {String} northId - The North ID connector
   * @param {Logger} logger - The logger
   * @param {String} baseFolder - The North cache folder
   * @return {void}
   */
  constructor(northId, logger, baseFolder) {
    this.northId = northId
    this.logger = logger
    this.baseFolder = baseFolder
  }
}

module.exports = BaseCache
