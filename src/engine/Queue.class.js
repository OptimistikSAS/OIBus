/**
 * Class Queue : manages a queue containing timestamped measurements
 */
class Queue {
  /**
   * @constructor for the class Queue
   */
  constructor(engine) {
    this.buffer = []
    engine.registerQueue(this)
  }

  /**
   * Updates the queue
   * @param {Object} entry : new entry (pointId, timestamp and data of the entry)
   * @return {void}
   */
  enqueue(value) {
    this.buffer.push(value)
  }

  /**
   * Removes the first (oldest) entry in the queue
   * @return {Object} entry : the removed entry is returned
   */
  dequeue() {
    return this.buffer.shift()
  }

  /**
   * Provides an Object with informations about the queue.
   * Currently only contains its length.
   * @return {Object} informations about the queue
   */
  info() {
    return { length: Object.keys(this.buffer).length }
  }
}

module.exports = Queue
