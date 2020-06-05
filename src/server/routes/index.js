const Router = require('@koa/router')

const configController = require('../controllers/configController')
const logController = require('../controllers/logController')
const engineController = require('../controllers/engineController')

const router = new Router()

router.get('/config', configController.getActiveConfiguration)
router.put('/config', configController.updateConfig)
router.put('/config/activate', configController.activateConfiguration)

router.get('/config/schemas/north', engineController.getNorthList)
router.get('/config/schemas/south', engineController.getSouthList)
router.post('/engine/addValues', engineController.addValues)
router.post('/engine/aliveSignal', engineController.aliveSignal)
router.get('/status', engineController.getStatus)
router.get('/reload', engineController.reload)

router.get('/logs', logController.getLogs)

module.exports = router
