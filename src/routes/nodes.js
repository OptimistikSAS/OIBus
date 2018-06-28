const Router = require('koa-router')

const router = new Router()
const Ctrl = require('../controllers/nodes')

router.get('/', Ctrl.getNode)

module.exports = router.routes()
