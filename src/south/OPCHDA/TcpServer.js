import net from 'node:net'

import SocketSession from './SocketSession.js'

export default class TcpServer {
  constructor(port, handleMessage, logger) {
    this.port = port
    this.handleMessage = handleMessage
    this.logger = logger
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
      this.logger.info(`TCP server listening on port ${this.port}`)
    })

    // Listener for 'connection' event
    this.server.on('connection', (socket) => {
      const name = `${socket.remoteAddress}:${socket.remotePort}`
      this.logger.info(`New connection attempt from ${name}`)

      if (!this.session) {
        this.session = new SocketSession(socket, this, this.handleMessage.bind(this))
      } else {
        this.logger.error(`Session already open, closing connection from ${name}`)
        socket.destroy()
      }
    })

    // Listener for the 'close' event
    this.server.on('close', () => {
      this.logger.info('TCP server closed')
    })

    // Listener for the 'error' event
    this.server.on('error', (error) => {
      this.logger.error(error)
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
