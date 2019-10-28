const mqtt = require('mqtt')
const ProtocolHandler = require('../ProtocolHandler.class')

class MQTT extends ProtocolHandler {
  /**
   * Initiate connection and start listening.
   * @todo: Warning: this protocol needs rework to be production ready
   * @return {void}
   */
  connect() {
    super.connect()
    this.topics = {}
    this.listen()
  }

  /**
   * Listen for messages.
   * @return {void}
   */
  listen() {
    const { points } = this.dataSource
    const { mqttProtocol, server, port, username, password } = this.dataSource.MQTT
    this.client = mqtt.connect(`${mqttProtocol}://${server}`, { port, username, password: Buffer.from(this.decryptPassword(password)) })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })

    this.client.on('connect', () => {
      points.forEach((point) => {
        const { topic, pointId } = point
        this.topics[topic] = { pointId }
        this.client.subscribe(topic, { qos: 2 }, (error) => {
          if (error) {
            this.logger.error(error)
          }
        })
      })

      this.client.on('message', (topic, message, packet) => {
        this.logger.silly(`mqtt ${topic}:${message}, dup:${packet.dup}`)
        try {
          /** @todo: below should send by batch instead of single points */
          this.addValues([
            {
              pointId: this.topics[topic].pointId,
              timestamp: new Date().toISOString(),
              data: message.toString(),
            },
          ])
        } catch (error) {
          this.logger.error(error)
        }
      })
    })
  }

  /**
   * Close the connection
   * @return {void}
   */
  disconnect() {
    this.client.end(true)
  }
}

module.exports = MQTT
