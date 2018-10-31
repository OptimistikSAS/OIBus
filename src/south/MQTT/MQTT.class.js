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
          } else {
            console.info('Subscribe ', topic, ' succeeded!')
            console.info('For points ', pointId)
          }
        })
      })

      this.client.on('message', (topic1, message) => {
        // message is Buffer
        console.log('Message received from topic: ', topic1)
        this.engine.addValue({ data: message.toString(), timestamp: Date(), pointId })
        // client.end()
      })
    })
  }
}
module.exports = MQTT
