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
    this.topics = {}
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
    // JFH. review the logic?
    // 1/ on connect forEachPoint subscribe to all the topics and fill pointIds[topic]
    // 2/ on message update pointIds[topic] with message

    this.client.on('connect', () => {
      points.forEach((point) => {
        const { topic, pointId, doNotGroup = false } = point
        this.topics[topic] = { pointId, doNotGroup }
        this.client.subscribe(topic, (error) => {
          if (error) {
            this.logger.error(error)
          }
        })
      })

      this.client.on('message', (topic, message) => {
        console.log(topic.toString(), message.toString())

        this.addValue(
          {
            data: message.toString(),
            timestamp: new Date().getTime(),
            pointId: this.topics[topic].pointId,
          },
          this.topics[topic].doNotGroup,
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
