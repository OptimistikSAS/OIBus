import Router from '@koa/router'
import multer from '@koa/multer'

import configController from '../controllers/config.controller.js'
import logController from '../controllers/log.controller.js'
import engineController from '../controllers/engine.controller.js'
import historyQueryController from '../controllers/history-query.controller.js'
import oibusController from '../controllers/oibus.controller.js'
import fileCacheController from '../controllers/file-cache.controller.js'

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
router.get('/config/schemas/north', engineController.getNorthList)
router.get('/config/schemas/south', engineController.getSouthList)
router.post('/engine/addValues', engineController.addValues)
router.post('/engine/addFile', upload.single('file'), engineController.addFile)
router.post('/engine/aliveSignal', engineController.aliveSignal)
router.get('/info', engineController.getOIBusInfo)
router.get('/reload', oibusController.reload)
router.get('/shutdown', oibusController.shutdown)
router.get('/logs', logController.getLogsEndpoint)
router.post('/logs', logController.addLogs)

router.post('/history-queries', historyQueryController.createHistoryQuery)
router.get('/history-queries', historyQueryController.getHistoryQueries)
router.get('/history-queries/:id', historyQueryController.getHistoryQueryById)
router.put('/history-queries/:id', historyQueryController.updateHistoryQuery)
router.put('/history-queries/:id/enable', historyQueryController.enableHistoryQuery)
router.put('/history-queries/:id/order', historyQueryController.orderHistoryQuery)
router.delete('/history-queries/:id', historyQueryController.deleteHistoryQuery)
router.get('/history-queries/:id/status', historyQueryController.getStatus)

router.get('/north/:id/cache/file-errors', fileCacheController.getFileErrors)
router.delete('/north/:id/cache/file-errors', fileCacheController.removeFileErrors)
router.post('/north/:id/cache/file-errors/retry', fileCacheController.retryFileErrors)
router.delete('/north/:id/cache/file-errors/remove-all', fileCacheController.removeAllFileErrors)
router.post('/north/:id/cache/file-errors/retry-all', fileCacheController.retryAllFileErrors)

export default router
