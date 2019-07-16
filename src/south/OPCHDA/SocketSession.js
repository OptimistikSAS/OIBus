/**
 * Class representing a connected session.
 */
class SocketSession {
  constructor(socket, tcpServer, logger, handleMessage) {
    this.socket = socket
    this.tcpServer = tcpServer
    this.logger = logger
    this.handleMessage = handleMessage
    this.name = `${socket.remoteAddress}:${socket.remotePort}`
    this.receivedMessage = ''

    this.logger.info(`Connection accepted from ${this.name}`)

    this.bindSocketEvents()
  }

  /**
   * Bind socket events.
   * @return {void}
   */
  bindSocketEvents() {
    // Listener for the 'data' event
    this.socket.on('data', async (data) => {
      const content = data.toString()
      const responses = []

      if (content.includes('\n')) {
        const messageParts = content.split('\n')

        messageParts.forEach(async (messagePart, index) => {
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

      responses.forEach(async (response) => {
        await this.handleMessage(response.trim())
      })
    })

    // Listener for the 'close' event
    this.socket.on('close', () => {
      this.logger.info(`Connection with ${this.name} closed`)
      this.tcpServer.removeSession()
      const disconnectMessage = {
        Reply: 'Disconnect',
        TransactionId: '',
        Content: {},
      }
      this.handleMessage(JSON.stringify(disconnectMessage))
    })

    // Listener for the 'error' event
    this.socket.on('error', (error) => {
      this.logger.error(error.message, error)
    })
  }

  /**
   * Send message to the client.
   * @param {string} message - The message to be sent
   * @returns {void}
   */
  sendMessage(message) {
    this.socket.write(`${message}\n`)
  }

  /**
   * Close the session.
   * @returns {void}
   */
  close() {
    if (this.socket) {
      this.socket.destroy()
    }
  }
}

module.exports = SocketSession
