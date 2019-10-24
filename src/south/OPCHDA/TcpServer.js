const net = require('net')

const SocketSession = require('./SocketSession')

class TcpServer {
  constructor(port, handleMessage, logSource) {
    this.port = port
    this.handleMessage = handleMessage
    this.logSource = logSource
    this.server = null
    this.session = null
  }

  /**
   * Bind server events.
   * @return {void}
   */
  bindServerEvents() {
    // Listener for the 'listening' event
    this.server.on('listening', () => {
      logger.info(`TCP server listening on port ${this.port}`, this.logSource)
    })

    // Listener for 'connection' event
    this.server.on('connection', (socket) => {
      const name = `${socket.remoteAddress}:${socket.remotePort}`
      logger.info(`New connection attempt from ${name}`, this.logSource)

      if (!this.session) {
        this.session = new SocketSession(socket, this, this.handleMessage.bind(this))
      } else {
        logger.error(`Session already open, closing connection from ${name}`, this.logSource)
        socket.destroy()
      }
    })

    // Listener for the 'close' event
    this.server.on('close', () => {
      logger.info('TCP server closed', this.logSource)
    })

    // Listener for the 'error' event
    this.server.on('error', (error) => {
      logger.error(error, this.logSource)
    })
  }

  /**
   * Start the server
   * @param {Function} callback - The listener for the 'listening' event
   * @return {void}
   */
  start(callback) {
    this.server = net.createServer()

    // Bind server events
    this.bindServerEvents()

    // Start listening
    this.server.listen(this.port, callback)
  }

  /**
   * Remove a session.
   * @return {void}
   */
  removeSession() {
    this.session = null
  }

  /**
   * Send message to the client.
   * @param {string} message - The message to send
   * @returns {void}
   */
  sendMessage(message) {
    if (this.session) {
      this.session.sendMessage(message)
    }
  }

  /**
   * Stop the TCP server.
   * @returns {void}
   */
  stop() {
    // Close the session
    if (this.session) {
      this.session.close()
      this.session = null
    }

    // Stop and unref the server
    if (this.server) {
      this.server.close()
      this.server.unref()
    }
  }
}

module.exports = TcpServer
