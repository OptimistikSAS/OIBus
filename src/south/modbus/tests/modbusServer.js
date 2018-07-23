const modbus = require('jsmodbus')
const net = require('net')

const netServer = new net.Server()
const server = new modbus.server.TCP(netServer)

server.on('connection', (_client) => {
  console.log('New Connection')
})

server.on('ReadCoils', (request, response, send) => {
  response.body.coils[0] = true
  response.body.coils[1] = false
  console.log('Received request')
  console.log(response)
  send(response)
})

module.exports = netServer
