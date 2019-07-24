const mqtt = require('mqtt')
const ProtocolHandler = require('../ProtocolHandler.class')

class MQTT extends ProtocolHandler {
  /**
   * Initiate connection and start listening.
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
    const { mqttProtocol, server, port, username, password, points } = this.dataSource
    this.client = mqtt.connect(`${mqttProtocol}://${server}`, { port, username, password: Buffer.from(this.decryptPassword(password)) })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })

    this.client.on('connect', () => {
      points.forEach((point) => {
        const { topic, pointId, urgent = false } = point
        this.topics[topic] = { pointId, urgent }
        this.client.subscribe(topic, (error) => {
          if (error) {
            this.logger.error(error)
          }
        })
      })

      this.client.on('message', (topic, message) => {
        this.logger.silly(`topic ${topic}, message ${message}`)
        const data = JSON.parse(message.toString())
        data.value = data.value.toString()
        data.quality = data.quality.toString()
        this.addValue(
          {
            data,
            timestamp: new Date().toISOString(),
            pointId: this.topics[topic].pointId,
          },
          this.topics[topic].urgent,
        )
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

MQTT.schema = require('./schema')

module.exports = MQTT
