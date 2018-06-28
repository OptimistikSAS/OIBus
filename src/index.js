require('dotenv').config()
const server = require('./server')

const port = process.env.PORT || 3333
server.listen(port, () => console.log(`API server started on ${port}`))
