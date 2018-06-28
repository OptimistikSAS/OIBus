const Router = require('koa-router')

const router = new Router()
const Ctrl = require('../controllers/users')

router.get('/', Ctrl.getUser)

module.exports = router.routes()
