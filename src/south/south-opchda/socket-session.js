/**
 * Class representing a connected socketSession.
 */
class SocketSession {
  /**
   * @param {Object} socket - The socket parameters
   * @param {Object} logger - The logger
   * @param {Function} closeCallback - The TCP netServer
   * @param {Function} handleMessage - The method used to handle and parse messages
   */
  constructor(socket, logger, closeCallback, handleMessage) {
    this.socket = socket
    this.closeCallback = closeCallback
    this.handleMessage = handleMessage
    this.logger = logger
    this.name = `${socket.remoteAddress}:${socket.remotePort}`
    this.receivedMessage = ''
    this.bindSocketEvents()
  }

  /**
   * Bind socket events.
   * @return {void}
   */
  bindSocketEvents() {
    this.socket.on('data', async (data) => {
      const content = data.toString()
      const responses = []

      if (content.includes('\n')) {
        const messageParts = content.split('\n')

        messageParts.forEach((messagePart, index) => {
          if (index === 0) {
            this.receivedMessage += messagePart
            responses.push(this.receivedMessage)
            this.receivedMessage = ''
          } else if (index === messageParts.length - 1) {
            this.receivedMessage = messagePart
          } else {
            responses.push(messagePart)
          }
        })
      } else {
        this.receivedMessage += content
      }

      await Promise.all(responses.map((response) => this.handleMessage(response.trim())))
    })

    this.socket.on('close', async () => {
      await this.closeCallback()
    })

    this.socket.on('error', (error) => {
      this.logger.error(error)
    })
  }

  /**
   * Send message to the client.
   * @param {String} message - The message to be sent
   * @returns {void}
   */
  sendMessage(message) {
    this.socket.write(`${message}\n`)
  }

  /**
   * Close the socketSession.
   * @returns {void}
   */
  close() {
    if (this.socket) {
      this.socket.destroy()
    }
  }
}

module.exports = SocketSession
