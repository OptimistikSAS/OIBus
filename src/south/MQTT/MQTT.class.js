const mqtt = require('mqtt')
const ProtocolHandler = require('../ProtocolHandler.class')

class MQTT extends ProtocolHandler {
  connect() {
    super.connect()
    this.listen()
  }

  listen() {
    const { MQTT: { protocol, server, port, username, password } = {}, points } = this.equipment
    this.client = mqtt.connect(
      `${protocol}://${server}`,
      { port, username, password: Buffer.from(password) },
    )
    points.forEach((point) => {
      const { MQTT: { topic } = {}, pointId } = point
      this.client.on('connect', () => {
        this.client.subscribe(topic, (err) => {
          if (err) {
            console.error(err)
          }
        })
      })

      this.client.on('message', (topic1, message) => {
        if (topic1 === topic) {
          // message is Buffer
          this.engine.addValue({ data: message.toString(), timestamp: Date(), pointId })
        }
      })
    })
  }
}
module.exports = MQTT
