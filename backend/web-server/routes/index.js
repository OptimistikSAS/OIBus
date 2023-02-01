import Router from '@koa/router'
import multer from '@koa/multer'

import configController from '../controllers/config.controller.js'
import logController from '../controllers/log.controller.js'
import engineController from '../controllers/engine.controller.js'
import oibusController from '../controllers/oibus.controller.js'
import fileCacheController from '../controllers/file-cache.controller.js'
import southConnectorController from '../controllers/south-connector.controller'
import northConnectorController from '../controllers/north-connector.controller'

import ValidatorService from '../../service/validator.service'
import ScanModeController from '../controllers/scan-mode.controller'
import ProxyController from '../controllers/proxy.controller'
import ExternalSourceController from '../controllers/external-source.controller'
import ApiController from '../controllers/api.controller'
import IpFilterController from '../controllers/ip-filter.controller'
import logApiController from '../controllers/log-api.controller'
import historyQueryController from '../controllers/history-query.controller'

const validatorService = new ValidatorService()
const scanModeController = new ScanModeController(validatorService.scanModeValidator)
const externalSourceController = new ExternalSourceController(validatorService.externalSourceValidator)
const proxyController = new ProxyController(validatorService.proxyValidator)
const apiController = new ApiController(validatorService.engineValidator)
const ipFilterController = new IpFilterController(validatorService.ipFilterValidator)
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

router.get('/legacy/installed-north', engineController.getNorthList)
router.get('/legacy/installed-south', engineController.getSouthList)
router.get('/legacy/north/:id', engineController.getNorth)
router.get('/legacy/south/:id', engineController.getSouth)

router.get('/north/:id/cache/file-errors', fileCacheController.getFileErrors)
router.delete('/north/:id/cache/file-errors', fileCacheController.removeFileErrors)
router.post('/north/:id/cache/file-errors/retry', fileCacheController.retryFileErrors)
router.delete('/north/:id/cache/file-errors/remove-all', fileCacheController.removeAllFileErrors)
router.post('/north/:id/cache/file-errors/retry-all', fileCacheController.retryAllFileErrors)

router.get('/api/scan-modes', (ctx) => scanModeController.getScanModes(ctx))
router.get('/api/scan-modes/:id', (ctx) => scanModeController.getScanMode(ctx))
router.post('/api/scan-modes', (ctx) => scanModeController.createScanMode(ctx))
router.put('/api/scan-modes/:id', (ctx) => scanModeController.updateScanMode(ctx))
router.delete('/api/scan-modes/:id', (ctx) => scanModeController.deleteScanMode(ctx))

router.get('/api/proxies', (ctx) => proxyController.getProxies(ctx))
router.get('/api/proxies/:id', (ctx) => proxyController.getProxy(ctx))
router.post('/api/proxies', (ctx) => proxyController.createProxy(ctx))
router.put('/api/proxies/:id', (ctx) => proxyController.updateProxy(ctx))
router.delete('/api/proxies/:id', (ctx) => proxyController.deleteProxy(ctx))

router.get('/api/external-sources', (ctx) => externalSourceController.getExternalSources(ctx))
router.get('/api/external-sources/:id', (ctx) => externalSourceController.getExternalSource(ctx))
router.post('/api/external-sources', (ctx) => externalSourceController.createExternalSource(ctx))
router.put('/api/external-sources/:id', (ctx) => externalSourceController.updateExternalSource(ctx))
router.delete('/api/external-sources/:id', (ctx) => externalSourceController.deleteExternalSource(ctx))

router.get('/api/engine', (ctx) => apiController.getEngineSettings(ctx))
router.put('/api/engine', (ctx) => apiController.updateEngineSettings(ctx))

router.get('/api/ip-filters', (ctx) => ipFilterController.getIpFilters(ctx))
router.get('/api/ip-filters/:id', (ctx) => ipFilterController.getIpFilter(ctx))
router.post('/api/ip-filters', (ctx) => ipFilterController.createIpFilter(ctx))
router.put('/api/ip-filters/:id', (ctx) => ipFilterController.updateIpFilter(ctx))
router.delete('/api/ip-filters/:id', (ctx) => ipFilterController.deleteIpFilter(ctx))

router.get('/api/north-types', northConnectorController.getNorthConnectorTypes)
router.get('/api/north-types/:id', northConnectorController.getNorthConnectorManifest)

router.get('/api/north', northConnectorController.getNorthConnectors)
router.get('/api/north/:id', northConnectorController.getNorthConnector)
router.post('/api/north', northConnectorController.createNorthConnector)
router.put('/api/north/:id', northConnectorController.updateNorthConnector)
router.delete('/api/north/:id', northConnectorController.deleteNorthConnector)

router.get('/api/south-types', southConnectorController.getSouthConnectorTypes)
router.get('/api/south-types/:id', southConnectorController.getSouthConnectorManifest)

router.get('/api/south', southConnectorController.getSouthConnectors)
router.get('/api/south/:id', southConnectorController.getSouthConnector)
router.post('/api/south', southConnectorController.createSouthConnector)
router.put('/api/south/:id', southConnectorController.updateSouthConnector)
router.delete('/api/south/:id', southConnectorController.deleteSouthConnector)

router.get('/api/south/:southId/items', southConnectorController.searchSouthItems)
router.get('/api/south/:southId/items/:id', southConnectorController.getSouthItem)
router.post('/api/south/:southId/items', southConnectorController.createSouthItem)
router.put('/api/south/:southId/items/:id', southConnectorController.updateSouthItem)
router.delete('/api/south/:southId/items/:id', southConnectorController.deleteSouthItem)

router.get('/api/history-queries', historyQueryController.getHistoryQueries)
router.get('/api/history-queries/:id', historyQueryController.getHistoryQuery)
router.post('/api/history-queries', historyQueryController.createHistoryQuery)
router.put('/api/history-queries/:id', historyQueryController.updateHistoryQuery)
router.delete('/api/history-queries/:id', historyQueryController.deleteHistoryQuery)

router.get('/api/logs', logApiController.searchLogs)
router.post('/api/logs', logApiController.addLogs)

export default router
