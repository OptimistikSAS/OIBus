/**
 * Class Responses : allows to manage requests responses in a Map
 */
class Queue {
  /**
   * Constructor for the class ResponsesHandler
   */
  constructor(engine) {
    this.buffer = []
    engine.registerQueue(this)
  }

  /**
   * Updates the queues map
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @return {void}
   */
  enqueue(value) {
    this.buffer.push(value)
    // Ajouter une alerte pour tous les protocoles/applications
  }

  dequeue() {
    return this.buffer.shift()
  }

  info() {
    return { length: Object.keys(this.buffer).length }
  }

  // Quand la map est mise à jour un évènement est créé pour toutes les applications
  // Quand remove seule 1 app (celle qui remove) est alertée
}

module.exports = Queue
