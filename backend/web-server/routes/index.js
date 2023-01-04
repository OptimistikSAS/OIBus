import Router from '@koa/router'
import multer from '@koa/multer'

import configController from '../controllers/config.controller.js'
import logController from '../controllers/log.controller.js'
import engineController from '../controllers/engine.controller.js'
import historyQueryController from '../controllers/history-query.controller.js'
import oibusController from '../controllers/oibus.controller.js'
import fileCacheController from '../controllers/file-cache.controller.js'
import apiController from '../controllers/api.controller'
import proxyController from '../controllers/proxy.controller'
import externalSourceController from '../controllers/external-source.controller'
import ipFilterController from '../controllers/ip-filter.controller'
import scanModeController from '../controllers/scan-mode.controller'
import southConnectorController from '../controllers/south-connector.controller'

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
router.post('/engine/addValues', engineController.addValues)
router.post('/engine/addFile', upload.single('file'), engineController.addFile)
router.post('/engine/aliveSignal', engineController.aliveSignal)
router.get('/info', engineController.getOIBusInfo)
router.get('/reload', oibusController.reload)
router.get('/shutdown', oibusController.shutdown)
router.get('/logs', logController.getLogsEndpoint)
router.post('/logs', logController.addLogs)

router.get('/api/installed-north', engineController.getNorthList)
router.get('/api/installed-south', engineController.getSouthList)
router.get('/api/north/:id', engineController.getNorth)
router.get('/api/south/:id', engineController.getSouth)

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

router.get('/api/engine', apiController.getEngineSettings)
router.put('/api/engine', apiController.updateEngineSettings)
router.get('/api/proxies', proxyController.getProxies)
router.get('/api/proxies/:id', proxyController.getProxy)
router.post('/api/proxies', proxyController.createProxy)
router.put('/api/proxies/:id', proxyController.updateProxy)
router.delete('/api/proxies/:id', proxyController.deleteProxy)
router.get('/api/scan-modes', scanModeController.getScanModes)
router.get('/api/scan-modes/:id', scanModeController.getScanMode)
router.post('/api/scan-modes', scanModeController.createScanMode)
router.put('/api/scan-modes/:id', scanModeController.updateScanMode)
router.delete('/api/scan-modes/:id', scanModeController.deleteScanMode)
router.get('/api/ip-filters', ipFilterController.getIpFilters)
router.get('/api/ip-filters/:id', ipFilterController.getIpFilter)
router.post('/api/ip-filters', ipFilterController.createIpFilter)
router.put('/api/ip-filters/:id', ipFilterController.updateIpFilter)
router.delete('/api/ip-filters/:id', ipFilterController.deleteIpFilter)
router.get('/api/external-sources', externalSourceController.getExternalSources)
router.get('/api/external-sources/:id', externalSourceController.getExternalSource)
router.post('/api/external-sources', externalSourceController.createExternalSource)
router.put('/api/external-sources/:id', externalSourceController.updateExternalSource)
router.delete('/api/external-sources/:id', externalSourceController.deleteExternalSource)
router.get('/api/south-connector', southConnectorController.getSouthConnectors)
router.get('/api/south-connector/:id', southConnectorController.getSouthConnector)
router.post('/api/south-connector', southConnectorController.createSouthConnector)
router.put('/api/south-connector/:id', southConnectorController.updateSouthConnector)
router.delete('/api/south-connector/:id', southConnectorController.deleteSouthConnector)
router.get('/api/south-connector/:southId/scan', southConnectorController.getSouthScans)
router.get('/api/south-connector/:southId/scan/:id', southConnectorController.getSouthScan)
router.post('/api/south-connector/:southId/scan', southConnectorController.createSouthScan)
router.put('/api/south-connector/:southId/scan/:id', southConnectorController.updateSouthScan)
router.delete('/api/south-connector/:southId/scan/:id', southConnectorController.deleteSouthScan)

export default router
