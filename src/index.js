require('dotenv').config()
const server = require('./server')
const getConfig = require('./south/modbus/config/modbus.config')
const modbusClient = require('./south/modbus/modbusClient')

// Connection options for client
const options = {
  host: 'localhost',
  port: 502,
}

getConfig() // Generates the optimized configuration

const port = process.env.PORT || 3333
server.listen(port, () => console.info(`API server started on ${port}`))
modbusClient.connect(options)
