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
   * dequeue all objects in the queue
   * @return {Array} All objects currently in the queue are returned
   */
  flush() {
    /** @todo to finish */
    console.log(this)
  }

  /**
   * Provides queue length
   * @return {Object} informations about the queue
   */
  get length() {
    return Object.keys(this.buffer).length
  }
}

module.exports = Queue
