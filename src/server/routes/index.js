const Router = require('koa-router')

const configController = require('../controllers/configController')
const schemaController = require('../controllers/schemaController')
const reloadController = require('../controllers/reloadController')
const clientController = require('../controllers/clientController')
const pointController = require('../controllers/pointController')
const logController = require('../controllers/logController')
const engineController = require('../controllers/engineController')
const statusController = require('../controllers/statusController')

const router = new Router()

router.get('/config', configController.getModifiedConfiguration)
router.get('/config/active', configController.getActiveConfiguration)
router.put('/config/engine', configController.updateEngine)
router.post('/config/north', configController.addNorth)
router.put('/config/north/:applicationId', configController.updateNorth)
router.delete('/config/north/:applicationId', configController.deleteNorth)
router.post('/config/south', configController.addSouth)
router.put('/config/south/:dataSourceId', configController.updateSouth)
router.delete('/config/south/:dataSourceId', configController.deleteSouth)
router.get('/config/south/:dataSourceId/points', pointController.getPoints)
router.post('/config/south/:dataSourceId/points', pointController.addPoint)
router.put('/config/south/:dataSourceId/points/:pointId', pointController.updatePoint)
router.delete('/config/south/:dataSourceId/points/:pointId', pointController.deletePoint)
router.delete('/config/south/:dataSourceId/points', pointController.deleteAllPoints)
router.get('/config/south/:dataSourceId/points/export', pointController.exportPoints)
router.post('/config/south/:dataSourceId/points/import', pointController.importPoints)
router.put('/config/activate', configController.activateConfiguration)
router.put('/config/reset', configController.resetConfiguration)

router.get('/config/schemas/north', schemaController.getNorthSchemaList)
router.get('/config/schemas/north/:api', schemaController.getNorthSchema)
router.get('/config/schemas/south', schemaController.getSouthSchemaList)
router.get('/config/schemas/south/:protocol', schemaController.getSouthSchema)

router.get('/logs', logController.getLogs)

router.get('/reload', reloadController.reload)

router.post('/engine/addValues', engineController.addValues)

router.get('/status', statusController.getStatus)

router.get('/*', clientController.serveClient)

module.exports = router
