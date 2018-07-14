const users = require('./users')
const nodes = require('./nodes')
const config = require('./config')

module.exports = (router) => {
  router.prefix('/v1')
  router.use('/users', users)
  router.use('/nodes', nodes)
  router.use('/config', config)
}
