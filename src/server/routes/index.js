const Router = require('koa-router')

const configController = require('../controllers/configController')
const reloadController = require('../controllers/reloadController')
const clientController = require('../controllers/clientController')

const router = new Router()

router.get('/config', configController.getConfig)
router.get('/config/schemas/north', configController.getNorthSchemaList)
router.get('/config/schemas/north/:api', configController.getNorthSchema)
router.get('/config/schemas/south', configController.getSouthSchemaList)
router.get('/config/schemas/south/:protocol', configController.getSouthSchema)

router.get('/reload', reloadController.reload)

router.get('/*', clientController.serveClient)

module.exports = router
