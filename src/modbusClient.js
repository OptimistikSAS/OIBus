const modbus = require('jsmodbus')
const net = require('net')

const socket = new net.Socket()
const client = new modbus.client.TCP(socket)
const options = {
  host: '35.180.21.237',
  port: 8502,
}

socket.on('connect', () => {
  client.readCoils(0, 8)
    .then((resp) => {
      console.log('Respone from server: ', resp)
      socket.end()
    }).catch((error) => {
      console.error(error)
      socket.end()
    })
})
socket.connect(options)
