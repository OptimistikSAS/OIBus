import net from 'node:net'

import SocketSession from './socket-session.js'

/**
 * Class TcpServer - Create a TCP netServer to communicate with the HDA agent
 */
export default class TcpServer {
  /**
   * Create a TCP Server
   * @param {Number} port - The port to listen to
   * @param {Function} handleMessage - Callback to handle message with OPCHDA logic
   * @param {Object} logger - The logger to use, associated to the OPCHDA South Connector
   */
  constructor(port, handleMessage, logger) {
    this.port = port
    this.handleMessage = handleMessage
    this.logger = logger
    this.netServer = null
    this.socketSession = null
  }

  /**
   * Start the netServer
   * @param {Function} callback - The listener for the 'listening' event
   * @return {void}
   */
  start(callback) {
    this.netServer = net.createServer()

    // Bind netServer events
    this.bindServerEvents()

    // Start listening
    this.netServer.listen(this.port, callback)
  }

  /**
   * Bind netServer events.
   * @return {void}
   */
  bindServerEvents() {
    this.netServer.on('listening', () => {
      this.logger.info(`TCP server listening on port ${this.port}.`)
    })

    this.netServer.on('connection', (socket) => {
      const name = `${socket.remoteAddress}:${socket.remotePort}`
      this.logger.info(`New connection attempt from "${name}".`)

      if (!this.socketSession) {
        this.socketSession = new SocketSession(socket, this.logger, this.closeCallback.bind(this), this.handleMessage.bind(this))
        this.logger.info(`Connection accepted from "${name}".`)
      } else {
        this.logger.error(`Session already open, closing connection from "${name}".`)
        socket.destroy()
      }
    })

    this.netServer.on('close', () => {
      this.logger.info('TCP server closed.')
    })

    this.netServer.on('error', (error) => {
      this.logger.error(error)
    })
  }

  /**
   * @param {String} socketName - The name of the socket to close
   * Remove a socketSession when the socket close
   * @return {void}
   */
  async closeCallback(socketName) {
    this.logger.info(`Connection with "${socketName}" closed.`)
    this.socketSession = null
    const disconnectMessage = {
      Reply: 'Disconnect',
      TransactionId: '',
      Content: {},
    }
    await this.handleMessage(JSON.stringify(disconnectMessage))
  }

  /**
   * Send message to the client.
   * @param {String} message - The message to send
   * @returns {void}
   */
  sendMessage(message) {
    if (this.socketSession) {
      this.socketSession.sendMessage(message)
    }
  }

  /**
   * Stop the TCP netServer.
   * @returns {void}
   */
  stop() {
    if (this.socketSession) {
      this.socketSession.close()
      this.socketSession = null
    }

    if (this.netServer) {
      this.netServer.close()
      this.netServer.unref()
      this.netServer = null
    }
  }
}
