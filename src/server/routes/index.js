const Router = require('@koa/router')

const configController = require('../controllers/configController')
const pointController = require('../controllers/pointController')
const logController = require('../controllers/logController')
const engineController = require('../controllers/engineController')

const router = new Router()

router.get('/config', configController.getModifiedConfiguration)
router.get('/config/active', configController.getActiveConfiguration)
router.put('/config', configController.updateConfig)
router.get('/config/south/:dataSourceId/points/export', pointController.exportPoints)
router.put('/config/activate', configController.activateConfiguration)
router.put('/config/reset', configController.resetConfiguration)

router.get('/config/schemas/north', engineController.getNorthList)
router.get('/config/schemas/south', engineController.getSouthList)
router.post('/engine/addValues', engineController.addValues)
router.get('/status', engineController.getStatus)
router.get('/reload', engineController.reload)

router.get('/logs', logController.getLogs)

module.exports = router
