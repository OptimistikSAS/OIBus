/**
 * Class ResponsesHandler : allows to manage requests responses in a Map
 */
class ResponsesHandler {
  /**
   * Constructor for the class ResponsesHandler
   */
  constructor() {
    this.responses = {}
    this.mapInit()
  }

  /**
   * Fills the map with as many Arrays as there are pointId's in the config file
   * With the pointId as a key.
   * @return {void}
   */
  mapInit() {
    global.fTbusConfig.equipments.forEach((equipment) => {
      equipment.points.forEach((point) => {
        this.responses[point.pointId] = []
      })
    })
  }

  /**
   * Updates the responses map
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @param {Function} callback : callback function
   * @return {void}
   */
  update({ pointId, timestamp, data }, callback) {
    this.responses[pointId].push({ timestamp, data })
    if (callback) callback()
  }
}

module.exports = ResponsesHandler
