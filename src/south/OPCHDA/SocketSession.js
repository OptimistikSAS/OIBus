/**
 * Class representing a connected session.
 */
export default class SocketSession {
  constructor(socket, tcpServer, handleMessage) {
    this.socket = socket
    this.tcpServer = tcpServer
    this.handleMessage = handleMessage
    this.logger = tcpServer.logger
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

      // eslint-disable-next-line no-restricted-syntax
      for (const response of responses) {
        // eslint-disable-next-line no-await-in-loop
        await this.handleMessage(response.trim())
      }
    })

    // Listener for the 'close' event
    this.socket.on('close', async () => {
      this.logger.info(`Connection with ${this.name} closed`)
      this.tcpServer.removeSession()
      const disconnectMessage = {
        Reply: 'Disconnect',
        TransactionId: '',
        Content: {},
      }
      await this.handleMessage(JSON.stringify(disconnectMessage))
    })

    // Listener for the 'error' event
    this.socket.on('error', (error) => {
      this.logger.error(error)
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
