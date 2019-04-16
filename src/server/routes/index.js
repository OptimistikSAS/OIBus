const Router = require('koa-router')

const configController = require('../controllers/configController')
const schemaController = require('../controllers/schemaController')
const reloadController = require('../controllers/reloadController')
const clientController = require('../controllers/clientController')

const router = new Router()

router.get('/config', configController.getConfig)
router.post('/config/north', configController.addNorth)
router.put('/config/north/:applicationId', configController.updateNorth)
router.delete('/config/north/:applicationId', configController.deleteNorth)
router.post('/config/south', configController.addSouth)
router.put('/config/south/:equipmentId', configController.updateSouth)
router.delete('/config/south/:equipmentId', configController.deleteSouth)

router.get('/config/schemas/north', schemaController.getNorthSchemaList)
router.get('/config/schemas/north/:api', schemaController.getNorthSchema)
router.get('/config/schemas/south', schemaController.getSouthSchemaList)
router.get('/config/schemas/south/:protocol', schemaController.getSouthSchema)

router.get('/reload', reloadController.reload)

router.get('/*', clientController.serveClient)

module.exports = router
