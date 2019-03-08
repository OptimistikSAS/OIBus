const Router = require('koa-router')

const configController = require('../controllers/configController')

const router = new Router()
router.get('/config', configController.getConfig)

module.exports = router
