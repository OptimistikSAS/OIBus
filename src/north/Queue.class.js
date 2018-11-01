/**
 * Class Queue : manages a queue containing timestamped measurements
 */
class Queue {
  /**
   * @constructor for the class Queue
   */
  constructor() {
    this.buffer = []
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
    const flushingArray = []
    while (this.length) {
      flushingArray.push(this.dequeue())
    }
    return flushingArray
  }

  /**
   * Provides queue length
   * @return {Number} length of the queue
   */
  get length() {
    return this.buffer.length
  }
}

module.exports = Queue
