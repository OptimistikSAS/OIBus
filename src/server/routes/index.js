const Router = require('@koa/router')
const multer = require('@koa/multer')

const configController = require('../controllers/configController')
const logController = require('../controllers/logController')
const engineController = require('../controllers/engineController')
const historyQueryController = require('../controllers/historyQueryController')
const oibusController = require('../controllers/oibusController')

const router = new Router()

const storage = multer.diskStorage({
  filename(req, file, cb) {
    cb(null, file.originalname)
  },
})
const upload = multer({ storage })

router.get('/config', configController.getActiveConfiguration)
router.put('/config', configController.updateConfig)
router.put('/config/activate', configController.activateConfiguration)
router.get('/config/schemas/north', engineController.getNorthSchemas)
router.get('/config/schemas/south', engineController.getSouthSchemas)
router.post('/engine/addValues', engineController.addValues)
router.post('/engine/addFile', upload.single('file'), engineController.addFile)
router.post('/engine/aliveSignal', engineController.aliveSignal)
router.get('/status', engineController.getStatus)
router.get('/status/south/:id', engineController.getStatusForSouth)
router.get('/reload', oibusController.reload)
router.get('/shutdown', oibusController.shutdown)
router.get('/logs', logController.getLogs)
router.post('/logs', logController.addLogs)

router.post('/history-queries', historyQueryController.createHistoryQuery)
router.get('/history-queries', historyQueryController.getHistoryQueries)
router.get('/history-queries/:id', historyQueryController.getHistoryQueryById)
router.put('/history-queries/:id', historyQueryController.updateHistoryQuery)
router.put('/history-queries/:id/enable', historyQueryController.enableHistoryQuery)
router.put('/history-queries/:id/order', historyQueryController.orderHistoryQuery)
router.delete('/history-queries/:id', historyQueryController.deleteHistoryQuery)
router.get('/history-queries/:id/status', historyQueryController.getStatus)

module.exports = router
