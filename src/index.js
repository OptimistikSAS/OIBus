require('dotenv').config()
const server = require('./server')
const engine = require('./engine')

engine.start(() => console.info('Engine started.'))
const port = process.env.PORT || 3333
server.listen(port, () => console.info(`API server started on ${port}`))
