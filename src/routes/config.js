const Router = require('koa-router')

const router = new Router()
const Ctrl = require('../controllers/config')

router.get('/', Ctrl.getConfig)

module.exports = router.routes()
