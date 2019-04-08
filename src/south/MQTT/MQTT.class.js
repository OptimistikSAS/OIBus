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
    const { MQTT: { protocol, server, port, username, password } = {}, points } = this.equipment
    this.client = mqtt.connect(
      `${protocol}://${server}`,
      { port, username, password: Buffer.from(password) },
    )
    points.forEach((point) => {
      const { MQTT: { topic } = {}, pointId, doNotGroup = false } = point
      this.client.on('connect', () => {
        this.client.subscribe(topic, (err) => {
          if (err) {
            this.logger.error(err)
          }
        })
      })

      this.client.on('message', (topic1, message) => {
        if (topic1 === topic) {
          // message is Buffer
          this.engine.addValue({ data: message.toString(), timestamp: new Date().getTime(), pointId }, doNotGroup)
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

  /**
   * Method called to get the schema description.
   * @return {object} - The schema
   */
  static getSchema() {
    return super.getSchema(__dirname)
  }
}

module.exports = MQTT
