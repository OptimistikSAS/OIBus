/**
 * Class Queue : manages a queue containing timestamped measurements
 */
class Queue {
  /**
   * @constructor for the class Queue
   */
  constructor(engine) {
    this.buffer = []
    // each queue need to register to the calling engine
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
    const flushingArray = []
    while (this.length) {
      flushingArray.push(this.dequeue())
      // Maybe a callback after a dequeue could be useful ? see Console and InfluxDB
      // callback(flushingArray.slice(-1)[0]) callbacks on the entry added last
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
