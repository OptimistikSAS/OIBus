const mqtt = require('mqtt')
const ProtocolHandler = require('../ProtocolHandler.class')

class MQTT extends ProtocolHandler {
  /**
   * Initiate connection and start listening.
   * @return {void}
   */
  connect() {
    super.connect()
    this.listen()
  }

  /**
   * Listen for messages.
   * @return {void}
   */
  listen() {
    const { mqttProtocol, server, port, username, password, points } = this.dataSource
    this.client = mqtt.connect(
      `${mqttProtocol}://${server}`,
      { port, username, password: Buffer.from(password) },
    )
    points.forEach((point) => {
      const { MQTT: { topic } = {}, pointId, doNotGroup = false } = point
      this.client.on('connect', () => {
        this.client.subscribe(topic, (error) => {
          if (error) {
            this.logger.error(error)
          }
        })
      })

      this.client.on('message', (topic1, message) => {
        if (topic1 === topic) {
          // message is Buffer
          this.addValue(
            {
              data: message.toString(),
              timestamp: new Date().getTime(),
              pointId,
            },
            doNotGroup,
          )
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

MQTT.schema = require('./schema')

module.exports = MQTT
