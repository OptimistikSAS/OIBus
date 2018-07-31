/**
 * Class ResponsesHandler : allows to manage requests responses in a Map
 */
class ResponsesHandler {
  /**
   * Constructor for the class ResponsesHandler
   */
  constructor() {
    this.responses = new Map()
  }

  /**
   * Updates the responses map
   * @param {Object} entry : new entry (id and data of the entry)
   * @param {Function} callback : callback function
   * @return {void}
   */
  update({ id, data }, callback) {
    this.responses.set(id, data)
    callback(this.responses)
  }
}

module.exports = ResponsesHandler
