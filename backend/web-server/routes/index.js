import Router from '@koa/router'
import multer from '@koa/multer'

import { scanModeSchema, proxySchema, externalSourceSchema, engineSchema, ipFilterSchema } from '../../engine/oibus-validation-schema'

import configController from '../controllers/config.controller.js'
import logController from '../controllers/log.controller.js'
import engineController from '../controllers/engine.controller.js'
import oibusController from '../controllers/oibus.controller.js'
import fileCacheController from '../controllers/file-cache.controller.js'
import logApiController from '../controllers/log-api.controller'
import historyQueryController from '../controllers/history-query.controller'

import ScanModeController from '../controllers/scan-mode.controller'
import ProxyController from '../controllers/proxy.controller'
import ExternalSourceController from '../controllers/external-source.controller'
import ApiController from '../controllers/api.controller'
import IpFilterController from '../controllers/ip-filter.controller'
import NorthConnectorController from "../controllers/north-connector.controller"
import SouthConnectorController from "../controllers/south-connector.controller"
import JoiValidator from "../../validators/joi.validator"

const joiValidator = new JoiValidator()
const scanModeController = new ScanModeController(joiValidator, scanModeSchema)
const externalSourceController = new ExternalSourceController(joiValidator, externalSourceSchema)
const proxyController = new ProxyController(joiValidator, proxySchema)
const apiController = new ApiController(joiValidator, engineSchema)
const ipFilterController = new IpFilterController(joiValidator, ipFilterSchema)
const northConnectorController = new NorthConnectorController(joiValidator)
const southConnectorController = new SouthConnectorController(joiValidator)
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

router.get('/api/north-types', (ctx) => northConnectorController.getNorthConnectorTypes(ctx))
router.get('/api/north-types/:id', (ctx) => northConnectorController.getNorthConnectorManifest(ctx))

router.get('/api/north', (ctx) => northConnectorController.getNorthConnectors(ctx))
router.get('/api/north/:id', (ctx) => northConnectorController.getNorthConnector(ctx))
router.post('/api/north', (ctx) => northConnectorController.createNorthConnector(ctx))
router.put('/api/north/:id', (ctx) => northConnectorController.updateNorthConnector(ctx))
router.delete('/api/north/:id', (ctx) => northConnectorController.deleteNorthConnector(ctx))

router.get('/api/south-types', (ctx) => southConnectorController.getSouthConnectorTypes(ctx))
router.get('/api/south-types/:id', (ctx) => southConnectorController.getSouthConnectorManifest(ctx))

router.get('/api/south', (ctx) => southConnectorController.getSouthConnectors(ctx))
router.get('/api/south/:id', (ctx) => southConnectorController.getSouthConnector(ctx))
router.post('/api/south', (ctx) => southConnectorController.createSouthConnector(ctx))
router.put('/api/south/:id', (ctx) => southConnectorController.updateSouthConnector(ctx))
router.delete('/api/south/:id', (ctx) => southConnectorController.deleteSouthConnector(ctx))

router.get('/api/south/:southId/items', (ctx) => southConnectorController.searchSouthItems(ctx))
router.get('/api/south/:southId/items/:id', (ctx) => southConnectorController.getSouthItem(ctx))
router.post('/api/south/:southId/items', (ctx) => southConnectorController.createSouthItem(ctx))
router.put('/api/south/:southId/items/:id', (ctx) => southConnectorController.updateSouthItem(ctx))
router.delete('/api/south/:southId/items/:id', (ctx) => southConnectorController.deleteSouthItem(ctx))

router.get('/api/history-queries', historyQueryController.getHistoryQueries)
router.get('/api/history-queries/:id', historyQueryController.getHistoryQuery)
router.post('/api/history-queries', historyQueryController.createHistoryQuery)
router.put('/api/history-queries/:id', historyQueryController.updateHistoryQuery)
router.delete('/api/history-queries/:id', historyQueryController.deleteHistoryQuery)

router.get('/api/logs', logApiController.searchLogs)
router.post('/api/logs', logApiController.addLogs)

export default router
