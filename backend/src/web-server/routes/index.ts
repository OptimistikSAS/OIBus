// @ts-ignore
import Router from '@koa/router';
import multer from '@koa/multer';

import LogController from '../controllers/log.controller';
import ScanModeController from '../controllers/scan-mode.controller';
import EngineController from '../controllers/engine.controller';
import IpFilterController from '../controllers/ip-filter.controller';
import NorthConnectorController from '../controllers/north-connector.controller';
import SouthConnectorController from '../controllers/south-connector.controller';
import UserController from '../controllers/user.controller';
import HistoryQueryController from '../controllers/history-query.controller';
import SubscriptionController from '../controllers/subscription.controller';
import JoiValidator from '../controllers/validators/joi.validator';
import { KoaContext } from '../koa';
import CertificateController from '../controllers/certificate.controller';
import OianalyticsRegistrationController from '../controllers/oianalytics-registration.controller';
import {
  certificateSchema,
  commandSchema,
  contentSchema,
  engineSchema,
  historyQuerySchema,
  ipFilterSchema,
  logSchema,
  registrationSchema,
  scanModeSchema,
  userSchema
} from '../controllers/validators/oibus-validation-schema';
import OianalyticsCommandController from '../controllers/oianalytics-command.controller';
import ContentController from '../controllers/content.controller';

const joiValidator = new JoiValidator();
const scanModeController = new ScanModeController(joiValidator, scanModeSchema);
const certificateController = new CertificateController(joiValidator, certificateSchema);
const commandController = new OianalyticsCommandController(joiValidator, commandSchema);
const engineController = new EngineController(joiValidator, engineSchema);
const contentController = new ContentController(joiValidator, contentSchema);
const registrationController = new OianalyticsRegistrationController(joiValidator, registrationSchema);
const ipFilterController = new IpFilterController(joiValidator, ipFilterSchema);
const northConnectorController = new NorthConnectorController(joiValidator);
const southConnectorController = new SouthConnectorController(joiValidator);
const historyQueryController = new HistoryQueryController(joiValidator, historyQuerySchema);
const userController = new UserController(joiValidator, userSchema);
const logController = new LogController(joiValidator, logSchema);
const subscriptionController = new SubscriptionController();

const router = new Router();

const storage = multer.diskStorage({
  filename(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

router.get('/api/users', (ctx: KoaContext<any, any>) => userController.search(ctx));
router.get('/api/users/:id', (ctx: KoaContext<any, any>) => userController.findById(ctx));
router.post('/api/users', (ctx: KoaContext<any, any>) => userController.create(ctx));
router.put('/api/users/:id', (ctx: KoaContext<any, any>) => userController.update(ctx));
router.put('/api/users/:id/change-password', (ctx: KoaContext<any, any>) => userController.changePassword(ctx));
router.delete('/api/users/:id', (ctx: KoaContext<any, any>) => userController.delete(ctx));

router.get('/api/scan-modes', (ctx: KoaContext<any, any>) => scanModeController.findAll(ctx));
router.post('/api/scan-modes/verify', (ctx: KoaContext<any, any>) => scanModeController.verifyScanMode(ctx));
router.get('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.findById(ctx));
router.post('/api/scan-modes', (ctx: KoaContext<any, any>) => scanModeController.create(ctx));
router.put('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.update(ctx));
router.delete('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.delete(ctx));

router.get('/api/certificates', (ctx: KoaContext<any, any>) => certificateController.findAll(ctx));
router.get('/api/certificates/:id', (ctx: KoaContext<any, any>) => certificateController.findById(ctx));
router.post('/api/certificates', (ctx: KoaContext<any, any>) => certificateController.create(ctx));
router.put('/api/certificates/:id', (ctx: KoaContext<any, any>) => certificateController.update(ctx));
router.delete('/api/certificates/:id', (ctx: KoaContext<any, any>) => certificateController.delete(ctx));

router.get('/api/engine', (ctx: KoaContext<any, any>) => engineController.getEngineSettings(ctx));
router.put('/api/engine', (ctx: KoaContext<any, any>) => engineController.updateEngineSettings(ctx));
router.put('/api/engine/reset-metrics', (ctx: KoaContext<any, any>) => engineController.resetEngineMetrics(ctx));
router.put('/api/restart', (ctx: KoaContext<any, any>) => engineController.restart(ctx));
router.put('/api/shutdown', (ctx: KoaContext<any, any>) => engineController.shutdown(ctx));
router.post('/api/add-content', upload.single('file'), (ctx: KoaContext<any, any>) => contentController.addContent(ctx));
router.get('/api/info', (ctx: KoaContext<any, any>) => engineController.getOIBusInfo(ctx));
router.get('/api/status', (ctx: KoaContext<any, any>) => engineController.getStatus(ctx));

router.get('/api/registration', (ctx: KoaContext<any, any>) => registrationController.get(ctx));
router.put('/api/registration', (ctx: KoaContext<any, any>) => registrationController.update(ctx));
router.put('/api/registration/edit', (ctx: KoaContext<any, any>) => registrationController.edit(ctx));
router.put('/api/registration/unregister', (ctx: KoaContext<any, any>) => registrationController.unregister(ctx));

router.get('/api/ip-filters', (ctx: KoaContext<any, any>) => ipFilterController.findAll(ctx));
router.get('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.findById(ctx));
router.post('/api/ip-filters', (ctx: KoaContext<any, any>) => ipFilterController.create(ctx));
router.put('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.update(ctx));
router.delete('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.delete(ctx));

router.get('/api/north-types', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectorTypes(ctx));
router.get('/api/north-types/:id', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectorManifest(ctx));

router.get('/api/north', (ctx: KoaContext<any, any>) => northConnectorController.findAll(ctx));
router.put('/api/north/:id/test-connection', (ctx: KoaContext<any, any>) => northConnectorController.testNorthConnection(ctx));
router.get('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.findById(ctx));
router.post('/api/north', (ctx: KoaContext<any, any>) => northConnectorController.create(ctx));
router.put('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.update(ctx));
router.delete('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.delete(ctx));
router.put('/api/north/:id/start', (ctx: KoaContext<any, any>) => northConnectorController.start(ctx));
router.put('/api/north/:id/stop', (ctx: KoaContext<any, any>) => northConnectorController.stop(ctx));
router.get('/api/north/:northId/subscriptions', (ctx: KoaContext<any, any>) => subscriptionController.getNorthSubscriptions(ctx));
router.post('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<any, any>) =>
  subscriptionController.createNorthSubscription(ctx)
);
router.delete('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<any, any>) =>
  subscriptionController.deleteNorthSubscription(ctx)
);
router.get('/api/north/:northId/cache/file-errors', (ctx: KoaContext<any, any>) => northConnectorController.getFileErrors(ctx));
router.get('/api/north/:northId/cache/file-errors/:filename', (ctx: KoaContext<any, any>) =>
  northConnectorController.getFileErrorContent(ctx)
);
router.post('/api/north/:northId/cache/file-errors/remove', (ctx: KoaContext<any, any>) => northConnectorController.removeFileErrors(ctx));
router.post('/api/north/:northId/cache/file-errors/retry', (ctx: KoaContext<any, any>) => northConnectorController.retryErrorFiles(ctx));
router.delete('/api/north/:northId/cache/file-errors/remove-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeAllErrorFiles(ctx)
);
router.delete('/api/north/:northId/cache/file-errors/retry-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.retryAllErrorFiles(ctx)
);

router.get('/api/north/:northId/cache/files', (ctx: KoaContext<any, any>) => northConnectorController.getCacheFiles(ctx));
router.get('/api/north/:northId/cache/files/:filename', (ctx: KoaContext<any, any>) => northConnectorController.getCacheFileContent(ctx));
router.post('/api/north/:northId/cache/files/remove', (ctx: KoaContext<any, any>) => northConnectorController.removeCacheFiles(ctx));
router.post('/api/north/:northId/cache/files/archive', (ctx: KoaContext<any, any>) => northConnectorController.archiveCacheFiles(ctx));

router.get('/api/north/:northId/cache/archive-files', (ctx: KoaContext<any, any>) => northConnectorController.getArchiveFiles(ctx));
router.get('/api/north/:northId/cache/archive-files/:filename', (ctx: KoaContext<any, any>) =>
  northConnectorController.getArchiveFileContent(ctx)
);
router.post('/api/north/:northId/cache/archive-files/remove', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeArchiveFiles(ctx)
);
router.post('/api/north/:northId/cache/archive-files/retry', (ctx: KoaContext<any, any>) =>
  northConnectorController.retryArchiveFiles(ctx)
);
router.delete('/api/north/:northId/cache/archive-files/remove-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeAllArchiveFiles(ctx)
);
router.delete('/api/north/:northId/cache/archive-files/retry-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.retryAllArchiveFiles(ctx)
);

router.put('/api/north/:northId/cache/reset-metrics', (ctx: KoaContext<any, any>) => northConnectorController.resetMetrics(ctx));

router.get('/api/north/:northId/cache/values', (ctx: KoaContext<any, any>) => northConnectorController.getCacheValues(ctx));
router.post('/api/north/:northId/cache/values/remove', (ctx: KoaContext<any, any>) => northConnectorController.removeCacheValues(ctx));
router.delete('/api/north/:northId/cache/values/remove-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeAllCacheValues(ctx)
);

router.get('/api/north/:northId/cache/value-errors', (ctx: KoaContext<any, any>) => northConnectorController.getValueErrors(ctx));
router.post('/api/north/:northId/cache/value-errors/remove', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeValueErrors(ctx)
);
router.delete('/api/north/:northId/cache/value-errors/remove-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeAllValueErrors(ctx)
);
router.post('/api/north/:northId/cache/value-errors/retry', (ctx: KoaContext<any, any>) => northConnectorController.retryValueErrors(ctx));
router.delete('/api/north/:northId/cache/value-errors/retry-all', (ctx: KoaContext<any, any>) =>
  northConnectorController.retryAllValueErrors(ctx)
);

router.get('/api/south-types', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectorTypes(ctx));
router.get('/api/south-types/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectorManifest(ctx));

router.get('/api/south', (ctx: KoaContext<any, any>) => southConnectorController.findAll(ctx));
router.put('/api/south/:id/test-connection', (ctx: KoaContext<any, any>) => southConnectorController.testSouthConnection(ctx));
router.get('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.findById(ctx));
router.post('/api/south', (ctx: KoaContext<any, any>) => southConnectorController.create(ctx));
router.put('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.update(ctx));
router.delete('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.delete(ctx));
router.put('/api/south/:id/start', (ctx: KoaContext<any, any>) => southConnectorController.start(ctx));
router.put('/api/south/:id/stop', (ctx: KoaContext<any, any>) => southConnectorController.stop(ctx));
router.put('/api/south/:id/items/test-item', (ctx: KoaContext<any, any>) => southConnectorController.testSouthItem(ctx));
router.get('/api/south/:southId/items', (ctx: KoaContext<any, any>) => southConnectorController.searchSouthItems(ctx));
router.get('/api/south/:southId/items/all', (ctx: KoaContext<any, any>) => southConnectorController.listSouthItems(ctx));
router.post('/api/south/:southId/items', (ctx: KoaContext<any, any>) => southConnectorController.createSouthItem(ctx));
router.post('/api/south/:southType/items/check-import/:southId', upload.single('file'), (ctx: KoaContext<any, any>) =>
  southConnectorController.checkImportSouthItems(ctx)
);
router.post('/api/south/:southId/items/import', (ctx: KoaContext<any, any>) => southConnectorController.importSouthItems(ctx));
router.put('/api/south/:southId/items/export', (ctx: KoaContext<any, any>) => southConnectorController.exportSouthItems(ctx));
router.put('/api/south/items/to-csv', (ctx: KoaContext<any, any>) => southConnectorController.southItemsToCsv(ctx));
router.get('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthItem(ctx));
router.put('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.updateSouthItem(ctx));
router.put('/api/south/:southId/items/:id/enable', (ctx: KoaContext<any, any>) => southConnectorController.enableSouthItem(ctx));
router.put('/api/south/:southId/items/:id/disable', (ctx: KoaContext<any, any>) => southConnectorController.disableSouthItem(ctx));
router.delete('/api/south/:southId/items/all', (ctx: KoaContext<any, any>) => southConnectorController.deleteAllSouthItem(ctx));
router.delete('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.deleteSouthItem(ctx));
router.put('/api/south/:southId/cache/reset-metrics', (ctx: KoaContext<any, any>) => southConnectorController.resetSouthMetrics(ctx));

router.get('/api/history-queries', (ctx: KoaContext<any, any>) => historyQueryController.findAll(ctx));
router.get('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.findById(ctx));
router.post('/api/history-queries', (ctx: KoaContext<any, any>) => historyQueryController.create(ctx));
router.put('/api/history-queries/:id/start', (ctx: KoaContext<any, any>) => historyQueryController.start(ctx));
router.put('/api/history-queries/:id/pause', (ctx: KoaContext<any, any>) => historyQueryController.pause(ctx));
router.put('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.update(ctx));
router.delete('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.deleteHistoryQuery(ctx));

router.get('/api/history-queries/:historyQueryId/south-items', (ctx: KoaContext<any, any>) =>
  historyQueryController.searchHistoryQueryItems(ctx)
);
router.post(
  '/api/history-queries/:southType/south-items/check-south-import/:historyQueryId',
  upload.single('file'),
  (ctx: KoaContext<any, any>) => historyQueryController.checkImportSouthItems(ctx)
);
router.post('/api/history-queries/:historyQueryId/south-items/import', (ctx: KoaContext<any, any>) =>
  historyQueryController.importSouthItems(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/export', (ctx: KoaContext<any, any>) =>
  historyQueryController.exportSouthItems(ctx)
);
router.put('/api/history-queries/south-items/to-csv', (ctx: KoaContext<any, any>) => historyQueryController.historySouthItemsToCsv(ctx));

router.get('/api/history-queries/:historyQueryId/south-items/all', (ctx: KoaContext<any, any>) => historyQueryController.listItems(ctx));

router.get('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<any, any>) =>
  historyQueryController.getHistoryQueryItem(ctx)
);
router.post('/api/history-queries/:historyQueryId/south-items', (ctx: KoaContext<any, any>) =>
  historyQueryController.createHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<any, any>) =>
  historyQueryController.updateHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id/enable', (ctx: KoaContext<any, any>) =>
  historyQueryController.enableHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id/disable', (ctx: KoaContext<any, any>) =>
  historyQueryController.disableHistoryQueryItem(ctx)
);
router.delete('/api/history-queries/:historyQueryId/south-items/all', (ctx: KoaContext<any, any>) =>
  historyQueryController.deleteAllItems(ctx)
);
router.delete('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<any, any>) =>
  historyQueryController.deleteHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:id/south/test-connection', (ctx: KoaContext<any, any>) =>
  historyQueryController.testSouthConnection(ctx)
);
router.put('/api/history-queries/:id/north/test-connection', (ctx: KoaContext<any, any>) =>
  historyQueryController.testNorthConnection(ctx)
);

router.get('/api/logs', (ctx: KoaContext<any, any>) => logController.search(ctx));
router.get('/api/scope-logs/suggestions', (ctx: KoaContext<any, any>) => logController.suggestScopes(ctx));
router.get('/api/scope-logs/:id', (ctx: KoaContext<any, any>) => logController.getScopeById(ctx));
router.post('/api/logs', (ctx: KoaContext<any, any>) => logController.addLogs(ctx));

router.get('/api/commands', (ctx: KoaContext<any, any>) => commandController.search(ctx));

export default router;
