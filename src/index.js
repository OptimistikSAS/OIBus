require('dotenv').config()
const server = require('./server')
const modbusServer = require('./modbusServer')

const port = process.env.PORT || 3333
server.listen(port, () => console.info(`API server started on ${port}`))
modbusServer.listen(502, () => console.info('Modbus server is listening on port 502'))
