const mqtt = require('mqtt')

const client = mqtt.connect('mqtt://test.mosquitto.org')
console.log('Started', client)
client.on('connect', () => {
  client.subscribe('presence', (err) => {
    if (!err) {
      client.publish('presence', 'Hello mqtt')
    }
  })
})

client.on('message', (topic, message) => {
  // message is Buffer
  console.log(message.toString())
  client.end()
})
let i = 0
while (true) {
  i += 1
  // console.log(i)
}
