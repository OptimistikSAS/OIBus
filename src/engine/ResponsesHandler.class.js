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
        this.responses[point.pointId] = new Map()
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
    this.responses[pointId].set(timestamp, data)
    if (callback) callback(this.responses[pointId])
  }
  // Quand la map est mise à jour un évènement est créé pour toutes les applications
  // Quand remove seule 1 app
}

module.exports = ResponsesHandler


// 