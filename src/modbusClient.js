const modbus = require('jsmodbus')
const net = require('net')

const socket = new net.Socket()
const client = new modbus.client.TCP(socket)
const options = {
  host: '35.180.21.237',
  port: 502,
}

socket.on('connect', () => {
  setInterval(() => {
    console.log('read')
    client
      .readCoils(0, 16)
      .then((resp) => {
        console.log('Response: ', JSON.stringify(resp.response))
        // socket.end()
      })
      .catch((error) => {
        console.error(error)
        socket.end()
      })
  }, 2000)
})
socket.connect(options)

