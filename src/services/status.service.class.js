const EventEmitter = require('node:events')
const { PassThrough } = require('node:stream')

/**
 * Class used to manage certificate files and their content
 */
class StatusService {
  constructor(initialStatusData = {}) {
    this.statusData = initialStatusData
    this.eventEmitter = new EventEmitter()
    this.eventEmitter.on('data', this.listener.bind(this))
  }

  /**
   * Listener attached to the event emitter 'data' event
   * @param {Object} data - The object to send to the stream
   * @return {void}
   */
  listener(data) {
    if (data && this.stream) {
      this.stream.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  /**
     * Send status to a data stream through an event emitter
     * @param {object} statusData - The North connector status to send
     * @returns {void}
     */
  updateStatusDataStream(statusData) {
    this.statusData = { ...this.statusData, ...statusData }
    this.eventEmitter.emit('data', this.statusData)
  }

  /**
   * Force the update of the data
   * @return {void}
   */
  forceDataUpdate() {
    this.eventEmitter.emit('data', this.statusData)
  }

  /**
   * Return the PassThrough stream to send the data to a webclient through a socket. Create it if necessary.
   * @returns {object} - Return a stream to pass the data through a socket
   */
  getDataStream() {
    if (this.stream) {
      this.stream.destroy()
    }
    this.stream = new PassThrough()
    return this.stream
  }

  /**
   * Retrieve the current status data
   * @returns {object} - The status data
   */
  getStatus() {
    return this.statusData
  }

  /**
   * Stop the stream and remove all listeners
   * @return {void}
   */
  stop() {
    this.eventEmitter.removeAllListeners()
    this.stream?.destroy()
  }
}

module.exports = StatusService
