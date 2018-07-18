const users = require('./users')
const nodes = require('./nodes')

module.exports = (router) => {
  router.prefix('/v1')
  router.use('/users', users)
  router.use('/nodes', nodes)
}
