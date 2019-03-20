const Router = require('koa-router')

const configController = require('../controllers/configController')
const reloadController = require('../controllers/reloadController')
const clientController = require('../controllers/clientController')

const router = new Router()

router.get('/config', configController.getConfig)
router.get('/reload', reloadController.reload)

router.get('/*', clientController.serveClient)

module.exports = router
