/**
 * Buffer implementation to group multiple south events into a single north update.
 */
class GroupingBuffer {
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

    // Local buffer and timer for grouping
    this.buffer = []
    this.timeout = null
  }

  /**
   * Add a new Value to the Buffer.
   * The Value will be stored in the buffer and sent back to Engine
   * after grouping several values based on the grouping configuration.
   * @param {object} value - The new value
   * @param {string} value.pointId - The ID of the point
   * @param {string} value.data - The value of the point
   * @param {number} value.timestamp - The timestamp
   * @param {boolean} doNotGroup - Whether to disable grouping
   * @return {void}
   */
  addValue(value, doNotGroup = false) {
    // If grouping is not enabled or doNotGroup is set forward the value immediately
    // Otherwise add it to the buffer for grouping
    if (!this.config.enabled || doNotGroup) {
      this.engine.sendValues([value])
    } else {
      // Store the value in the buffer
      this.buffer.push(value)

      // If the timer is not active activate it to send the values after maxTime is reached
      if (!this.timeout) {
        this.timeout = setTimeout(this.sendCallback.bind(this), 1000 * this.config.maxTime)
      }

      // Check whether the buffer's length reached the configured value
      if (this.buffer.length >= this.config.groupCount) {
        // Send the buffer
        this.engine.sendValues(this.buffer)

        // Empty the buffer
        this.buffer = []

        // Reset the timer
        if (this.timeout) {
          clearTimeout(this.timeout)
          this.timeout = null
        }
      }
    }
  }

  /**
   * Callback function used by the timer to send the values.
   * @return {void}
   */
  sendCallback() {
    this.engine.sendValues(this.buffer)
    this.buffer = []
    this.timeout = null
  }
}

module.exports = GroupingBuffer
