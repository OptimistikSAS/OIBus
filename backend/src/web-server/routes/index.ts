// @ts-ignore
import Router from '@koa/router';
import multer from '@koa/multer';

import {
  engineSchema,
  externalSourceSchema,
  ipFilterSchema,
  logSchema,
  proxySchema,
  scanModeSchema,
  historyQuerySchema,
  userSchema
} from '../../engine/oibus-validation-schema';

import LogController from '../controllers/log.controller';
import ScanModeController from '../controllers/scan-mode.controller';
import ProxyController from '../controllers/proxy.controller';
import ExternalSourceController from '../controllers/external-source.controller';
import OibusController from '../controllers/oibus.controller';
import IpFilterController from '../controllers/ip-filter.controller';
import NorthConnectorController, { northManifests } from '../controllers/north-connector.controller';
import SouthConnectorController, { southManifests } from '../controllers/south-connector.controller';
import UserController from '../controllers/user.controller';
import HistoryQueryController from '../controllers/history-query.controller';
import SubscriptionController from '../controllers/subscription.controller';
import JoiValidator from '../../validators/joi.validator';
import { KoaContext } from '../koa';
import HealthSignalController from '../controllers/health-signal.controller';

const joiValidator = new JoiValidator();
const scanModeController = new ScanModeController(joiValidator, scanModeSchema);
const externalSourceController = new ExternalSourceController(joiValidator, externalSourceSchema);
const proxyController = new ProxyController(joiValidator, proxySchema);
const oibusController = new OibusController(joiValidator, engineSchema);
const ipFilterController = new IpFilterController(joiValidator, ipFilterSchema);
const northConnectorController = new NorthConnectorController(joiValidator);
const southConnectorController = new SouthConnectorController(joiValidator);
const historyQueryController = new HistoryQueryController(joiValidator, historyQuerySchema, southManifests, northManifests);
const userController = new UserController(joiValidator, userSchema);
const logController = new LogController(joiValidator, logSchema);
const healthSignalController = new HealthSignalController(joiValidator, logSchema);
const subscriptionController = new SubscriptionController();

const router = new Router();

const storage = multer.diskStorage({
  filename(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

router.get('/api/users', (ctx: KoaContext<any, any>) => userController.searchUsers(ctx));
router.get('/api/users/:id', (ctx: KoaContext<any, any>) => userController.getUser(ctx));
router.post('/api/users', (ctx: KoaContext<any, any>) => userController.createUser(ctx));
router.put('/api/users/:id', (ctx: KoaContext<any, any>) => userController.updateUser(ctx));
router.put('/api/users/:id/change-password', (ctx: KoaContext<any, any>) => userController.changePassword(ctx));
router.delete('/api/users/:id', (ctx: KoaContext<any, any>) => userController.deleteUser(ctx));

router.get('/api/scan-modes', (ctx: KoaContext<any, any>) => scanModeController.getScanModes(ctx));
router.get('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.getScanMode(ctx));
router.post('/api/scan-modes', (ctx: KoaContext<any, any>) => scanModeController.createScanMode(ctx));
router.put('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.updateScanMode(ctx));
router.delete('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.deleteScanMode(ctx));

router.get('/api/proxies', (ctx: KoaContext<any, any>) => proxyController.getProxies(ctx));
router.get('/api/proxies/:id', (ctx: KoaContext<any, any>) => proxyController.getProxy(ctx));
router.post('/api/proxies', (ctx: KoaContext<any, any>) => proxyController.createProxy(ctx));
router.put('/api/proxies/:id', (ctx: KoaContext<any, any>) => proxyController.updateProxy(ctx));
router.delete('/api/proxies/:id', (ctx: KoaContext<any, any>) => proxyController.deleteProxy(ctx));

router.get('/api/external-sources', (ctx: KoaContext<any, any>) => externalSourceController.getExternalSources(ctx));
router.get('/api/external-sources/:id', (ctx: KoaContext<any, any>) => externalSourceController.getExternalSource(ctx));
router.post('/api/external-sources', (ctx: KoaContext<any, any>) => externalSourceController.createExternalSource(ctx));
router.put('/api/external-sources/:id', (ctx: KoaContext<any, any>) => externalSourceController.updateExternalSource(ctx));
router.delete('/api/external-sources/:id', (ctx: KoaContext<any, any>) => externalSourceController.deleteExternalSource(ctx));

router.get('/api/engine', (ctx: KoaContext<any, any>) => oibusController.getEngineSettings(ctx));
router.put('/api/engine', (ctx: KoaContext<any, any>) => oibusController.updateEngineSettings(ctx));
router.put('/api/restart', (ctx: KoaContext<any, any>) => oibusController.restart(ctx));
router.put('/api/shutdown', (ctx: KoaContext<any, any>) => oibusController.shutdown(ctx));
router.post('/api/add-values', (ctx: KoaContext<any, any>) => oibusController.addValues(ctx));
router.post('/api/add-file', upload.single('file'), (ctx: KoaContext<any, any>) => oibusController.addFile(ctx));
router.post('/api/health-signal', (ctx: KoaContext<any, any>) => healthSignalController.healthSignal(ctx));
router.get('/api/info', (ctx: KoaContext<any, any>) => oibusController.getOIBusInfo(ctx));

router.get('/api/ip-filters', (ctx: KoaContext<any, any>) => ipFilterController.getIpFilters(ctx));
router.get('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.getIpFilter(ctx));
router.post('/api/ip-filters', (ctx: KoaContext<any, any>) => ipFilterController.createIpFilter(ctx));
router.put('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.updateIpFilter(ctx));
router.delete('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.deleteIpFilter(ctx));

router.get('/api/north-types', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectorTypes(ctx));
router.get('/api/north-types/:id', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectorManifest(ctx));

router.get('/api/north', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectors(ctx));
router.get('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnector(ctx));
router.post('/api/north', (ctx: KoaContext<any, any>) => northConnectorController.createNorthConnector(ctx));
router.put('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.updateNorthConnector(ctx));
router.delete('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.deleteNorthConnector(ctx));
router.get('/api/north/:northId/subscriptions', (ctx: KoaContext<any, any>) => subscriptionController.getNorthSubscriptions(ctx));
router.post('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<any, any>) =>
  subscriptionController.createNorthSubscription(ctx)
);
router.delete('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<any, any>) =>
  subscriptionController.deleteNorthSubscription(ctx)
);
router.get('/api/north/:northId/cache/file-errors', (ctx: KoaContext<any, any>) => northConnectorController.getFileErrors(ctx));
router.post('/api/north/:northId/cache/file-errors/remove', (ctx: KoaContext<any, any>) => northConnectorController.removeFileErrors(ctx));
router.post('/api/north/:northId/cache/file-errors/retry', (ctx: KoaContext<any, any>) => northConnectorController.retryErrorFiles(ctx));
router.delete('/api/north/:northId/cache/file-errors/remove-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeAllErrorFiles(ctx)
);
router.delete('/api/north/:northId/cache/file-errors/retry-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.retryAllErrorFiles(ctx)
);
router.put('/api/north/:northId/cache/reset-metrics', (ctx: KoaContext<any, any>) => northConnectorController.resetNorthMetrics(ctx));

router.get('/api/south-types', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectorTypes(ctx));
router.get('/api/south-types/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectorManifest(ctx));

router.get('/api/south', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectors(ctx));
router.put('/api/south/test-connection', (ctx: KoaContext<any, any>) => southConnectorController.testSouthConnection(ctx));
router.get('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnector(ctx));
router.post('/api/south', (ctx: KoaContext<any, any>) => southConnectorController.createSouthConnector(ctx));
router.put('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.updateSouthConnector(ctx));
router.delete('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.deleteSouthConnector(ctx));
router.get('/api/south/:southId/items', (ctx: KoaContext<any, any>) => southConnectorController.searchSouthItems(ctx));
router.get('/api/south/:southId/items/all', (ctx: KoaContext<any, any>) => southConnectorController.listSouthItems(ctx));
router.post('/api/south/:southId/items', (ctx: KoaContext<any, any>) => southConnectorController.createSouthItem(ctx));
router.post('/api/south/:southId/items/upload', upload.single('file'), (ctx: KoaContext<any, any>) =>
  southConnectorController.uploadSouthItems(ctx)
);
router.get('/api/south/:southId/items/export', (ctx: KoaContext<any, any>) => southConnectorController.exportSouthItems(ctx));
router.get('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthItem(ctx));
router.put('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.updateSouthItem(ctx));
router.delete('/api/south/:southId/items/all', (ctx: KoaContext<any, any>) => southConnectorController.deleteAllSouthItem(ctx));
router.delete('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.deleteSouthItem(ctx));
router.put('/api/south/:southId/cache/reset-metrics', (ctx: KoaContext<any, any>) => southConnectorController.resetSouthMetrics(ctx));

router.get('/api/history-queries', (ctx: KoaContext<any, any>) => historyQueryController.getHistoryQueries(ctx));
router.get('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.getHistoryQuery(ctx));
router.post('/api/history-queries', (ctx: KoaContext<any, any>) => historyQueryController.createHistoryQuery(ctx));
router.put('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.updateHistoryQuery(ctx));
router.delete('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.deleteHistoryQuery(ctx));

router.get('/api/history-queries/:historyQueryId/items', (ctx: KoaContext<any, any>) =>
  historyQueryController.searchHistoryQueryItems(ctx)
);
router.get('/api/history-queries/:historyQueryId/items/export', (ctx: KoaContext<any, any>) => historyQueryController.exportItems(ctx));
router.get('/api/history-queries/:historyQueryId/items/:id', (ctx: KoaContext<any, any>) =>
  historyQueryController.getHistoryQueryItem(ctx)
);
router.post('/api/history-queries/:historyQueryId/items', (ctx: KoaContext<any, any>) =>
  historyQueryController.createHistoryQueryItem(ctx)
);
router.post('/api/history-queries/:historyQueryId/items/upload', upload.single('file'), (ctx: KoaContext<any, any>) =>
  historyQueryController.uploadItems(ctx)
);
router.put('/api/history-queries/:historyQueryId/items/:id', (ctx: KoaContext<any, any>) =>
  historyQueryController.updateHistoryQueryItem(ctx)
);
router.delete('/api/history-queries/:historyQueryId/items/all', (ctx: KoaContext<any, any>) => historyQueryController.deleteAllItems(ctx));
router.delete('/api/history-queries/:historyQueryId/items/:id', (ctx: KoaContext<any, any>) =>
  historyQueryController.deleteHistoryQueryItem(ctx)
);

router.get('/api/logs', (ctx: KoaContext<any, any>) => logController.searchLogs(ctx));
router.post('/api/logs', (ctx: KoaContext<any, any>) => logController.addLogs(ctx));

export default router;
