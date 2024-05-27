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
import RegistrationController from '../controllers/registration.controller';
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
  userSchema,
  transformerSchema
} from '../controllers/validators/oibus-validation-schema';
import CommandController from '../controllers/command.controller';
import ContentController from '../controllers/content.controller';
import TransformerController from '../controllers/transformer.controller';

const joiValidator = new JoiValidator();
const scanModeController = new ScanModeController(joiValidator, scanModeSchema);
const certificateController = new CertificateController(joiValidator, certificateSchema);
const commandController = new CommandController(joiValidator, commandSchema);
const engineController = new EngineController(joiValidator, engineSchema);
const contentController = new ContentController(joiValidator, contentSchema);
const registrationController = new RegistrationController(joiValidator, registrationSchema);
const ipFilterController = new IpFilterController(joiValidator, ipFilterSchema);
const northConnectorController = new NorthConnectorController(joiValidator);
const southConnectorController = new SouthConnectorController(joiValidator);
const historyQueryController = new HistoryQueryController(joiValidator, historyQuerySchema);
const userController = new UserController(joiValidator, userSchema);
const logController = new LogController(joiValidator, logSchema);
const subscriptionController = new SubscriptionController();
const transformerController = new TransformerController(joiValidator, transformerSchema);

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
router.post('/api/scan-modes/verify', (ctx: KoaContext<any, any>) => scanModeController.verifyScanMode(ctx));
router.get('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.getScanMode(ctx));
router.post('/api/scan-modes', (ctx: KoaContext<any, any>) => scanModeController.createScanMode(ctx));
router.put('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.updateScanMode(ctx));
router.delete('/api/scan-modes/:id', (ctx: KoaContext<any, any>) => scanModeController.deleteScanMode(ctx));

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

router.get('/api/registration', (ctx: KoaContext<any, any>) => registrationController.getRegistrationSettings(ctx));
router.put('/api/registration', (ctx: KoaContext<any, any>) => registrationController.updateRegistrationSettings(ctx));
router.put('/api/registration/unregister', (ctx: KoaContext<any, any>) => registrationController.unregister(ctx));

router.get('/api/ip-filters', (ctx: KoaContext<any, any>) => ipFilterController.getIpFilters(ctx));
router.get('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.getIpFilter(ctx));
router.post('/api/ip-filters', (ctx: KoaContext<any, any>) => ipFilterController.createIpFilter(ctx));
router.put('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.updateIpFilter(ctx));
router.delete('/api/ip-filters/:id', (ctx: KoaContext<any, any>) => ipFilterController.deleteIpFilter(ctx));

router.get('/api/north-types', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectorTypes(ctx));
router.get('/api/north-types/:id', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectorManifest(ctx));

router.get('/api/transformers', (ctx: KoaContext<any, any>) => transformerController.getTransformers(ctx));
router.get('/api/transformers/:id', (ctx: KoaContext<any, any>) => transformerController.getTransformer(ctx));
router.post('/api/transformers', (ctx: KoaContext<any, any>) => transformerController.createTransformer(ctx));
router.put('/api/transformers/:id', (ctx: KoaContext<any, any>) => transformerController.updateTransformer(ctx));
router.delete('/api/transformers/:id', (ctx: KoaContext<any, any>) => transformerController.deleteTransformer(ctx));

router.get('/api/north', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnectors(ctx));
router.put('/api/north/:id/test-connection', (ctx: KoaContext<any, any>) => northConnectorController.testNorthConnection(ctx));
router.get('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.getNorthConnector(ctx));
router.post('/api/north', (ctx: KoaContext<any, any>) => northConnectorController.createNorthConnector(ctx));
router.put('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.updateNorthConnector(ctx));
router.delete('/api/north/:id', (ctx: KoaContext<any, any>) => northConnectorController.deleteNorthConnector(ctx));
router.put('/api/north/:id/start', (ctx: KoaContext<any, any>) => northConnectorController.startNorthConnector(ctx));
router.put('/api/north/:id/stop', (ctx: KoaContext<any, any>) => northConnectorController.stopNorthConnector(ctx));
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
router.get('/api/north/:northId/items', (ctx: KoaContext<any, any>) => northConnectorController.searchNorthItems(ctx));
router.get('/api/north/:northId/items/all', (ctx: KoaContext<any, any>) => northConnectorController.listNorthItems(ctx));
router.post('/api/north/:northId/items', (ctx: KoaContext<any, any>) => northConnectorController.createNorthItem(ctx));
router.post('/api/north/:northId/items/upload', upload.single('file'), (ctx: KoaContext<any, any>) =>
  northConnectorController.uploadNorthItems(ctx)
);
router.get('/api/north/:northId/items/export', (ctx: KoaContext<any, any>) => northConnectorController.exportNorthItems(ctx));
router.get('/api/north/:northId/items/:id', (ctx: KoaContext<any, any>) => northConnectorController.getNorthItem(ctx));
router.put('/api/north/:northId/items/:id', (ctx: KoaContext<any, any>) => northConnectorController.updateNorthItem(ctx));
router.put('/api/north/:northId/items/:id/enable', (ctx: KoaContext<any, any>) => northConnectorController.enableNorthItem(ctx));
router.put('/api/north/:northId/items/:id/disable', (ctx: KoaContext<any, any>) => northConnectorController.disableNorthItem(ctx));
router.delete('/api/north/:northId/items/all', (ctx: KoaContext<any, any>) => northConnectorController.deleteAllNorthItem(ctx));
router.delete('/api/north/:northId/items/:id', (ctx: KoaContext<any, any>) => northConnectorController.deleteNorthItem(ctx));
router.put('/api/north/:northId/cache/reset-metrics', (ctx: KoaContext<any, any>) => northConnectorController.resetNorthMetrics(ctx));

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
router.get('/api/north/:northId/transformers', (ctx: KoaContext<any, any>) => northConnectorController.getTransformers(ctx));
router.post('/api/north/:northId/transformers/:transformerId', (ctx: KoaContext<any, any>) => northConnectorController.addTransformer(ctx));
router.delete('/api/north/:northId/transformers/:transformerId', (ctx: KoaContext<any, any>) =>
  northConnectorController.removeTransformer(ctx)
);

router.get('/api/south-types', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectorTypes(ctx));
router.get('/api/south-types/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectorManifest(ctx));

router.get('/api/south', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnectors(ctx));
router.put('/api/south/:id/test-connection', (ctx: KoaContext<any, any>) => southConnectorController.testSouthConnection(ctx));
router.get('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthConnector(ctx));
router.post('/api/south', (ctx: KoaContext<any, any>) => southConnectorController.createSouthConnector(ctx));
router.put('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.updateSouthConnector(ctx));
router.delete('/api/south/:id', (ctx: KoaContext<any, any>) => southConnectorController.deleteSouthConnector(ctx));
router.put('/api/south/:id/start', (ctx: KoaContext<any, any>) => southConnectorController.startSouthConnector(ctx));
router.put('/api/south/:id/stop', (ctx: KoaContext<any, any>) => southConnectorController.stopSouthConnector(ctx));
router.get('/api/south/:southId/items', (ctx: KoaContext<any, any>) => southConnectorController.searchSouthItems(ctx));
router.get('/api/south/:southId/items/all', (ctx: KoaContext<any, any>) => southConnectorController.listSouthItems(ctx));
router.post('/api/south/:southId/items', (ctx: KoaContext<any, any>) => southConnectorController.createSouthItem(ctx));
router.post('/api/south/:southType/items/check-import/:southId', upload.single('file'), (ctx: KoaContext<any, any>) =>
  southConnectorController.checkImportSouthItems(ctx)
);
router.post('/api/south/:southId/items/import', (ctx: KoaContext<any, any>) => southConnectorController.importSouthItems(ctx));
router.get('/api/south/:southId/items/export', (ctx: KoaContext<any, any>) => southConnectorController.exportSouthItems(ctx));
router.get('/api/south/:southId/items/export', (ctx: KoaContext<any, any>) => southConnectorController.exportSouthItems(ctx));
router.put('/api/south/items/to-csv', (ctx: KoaContext<any, any>) => southConnectorController.southItemsToCsv(ctx));
router.get('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.getSouthItem(ctx));
router.put('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.updateSouthItem(ctx));
router.put('/api/south/:southId/items/:id/enable', (ctx: KoaContext<any, any>) => southConnectorController.enableSouthItem(ctx));
router.put('/api/south/:southId/items/:id/disable', (ctx: KoaContext<any, any>) => southConnectorController.disableSouthItem(ctx));
router.delete('/api/south/:southId/items/all', (ctx: KoaContext<any, any>) => southConnectorController.deleteAllSouthItem(ctx));
router.delete('/api/south/:southId/items/:id', (ctx: KoaContext<any, any>) => southConnectorController.deleteSouthItem(ctx));
router.put('/api/south/:southId/cache/reset-metrics', (ctx: KoaContext<any, any>) => southConnectorController.resetSouthMetrics(ctx));
router.get('/api/south/:southId/transformers', (ctx: KoaContext<any, any>) => southConnectorController.getTransformers(ctx));
router.post('/api/south/:southId/transformers/:transformerId', (ctx: KoaContext<any, any>) => southConnectorController.addTransformer(ctx));
router.delete('/api/south/:southId/transformers/:transformerId', (ctx: KoaContext<any, any>) =>
  southConnectorController.removeTransformer(ctx)
);

router.get('/api/history-queries', (ctx: KoaContext<any, any>) => historyQueryController.getHistoryQueries(ctx));
router.get('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.getHistoryQuery(ctx));
router.post('/api/history-queries', (ctx: KoaContext<any, any>) => historyQueryController.createHistoryQuery(ctx));
router.put('/api/history-queries/:id/start', (ctx: KoaContext<any, any>) => historyQueryController.startHistoryQuery(ctx));
router.put('/api/history-queries/:id/pause', (ctx: KoaContext<any, any>) => historyQueryController.pauseHistoryQuery(ctx));
router.put('/api/history-queries/:id', (ctx: KoaContext<any, any>) => historyQueryController.updateHistoryQuery(ctx));
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
router.get('/api/history-queries/:historyQueryId/south-items/export', (ctx: KoaContext<any, any>) =>
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
router.get('/api/history-queries/:historyQueryId/south-transformers', (ctx: KoaContext<any, any>) =>
  historyQueryController.getTransformers(ctx, 'south')
);
router.post('/api/history-queries/:historyQueryId/south-transformers/:transformerId', (ctx: KoaContext<any, any>) =>
  historyQueryController.addTransformer(ctx, 'south')
);
router.delete('/api/history-queries/:historyQueryId/south-transformers/:transformerId', (ctx: KoaContext<any, any>) =>
  historyQueryController.removeTransformer(ctx, 'south')
);
router.get('/api/history-queries/:historyQueryId/north-transformers', (ctx: KoaContext<any, any>) =>
  historyQueryController.getTransformers(ctx, 'north')
);
router.post('/api/history-queries/:historyQueryId/north-transformers/:transformerId', (ctx: KoaContext<any, any>) =>
  historyQueryController.addTransformer(ctx, 'north')
);
router.delete('/api/history-queries/:historyQueryId/north-transformers/:transformerId', (ctx: KoaContext<any, any>) =>
  historyQueryController.removeTransformer(ctx, 'north')
);

router.get('/api/logs', (ctx: KoaContext<any, any>) => logController.searchLogs(ctx));
router.get('/api/scope-logs/suggestions', (ctx: KoaContext<any, any>) => logController.suggestScopes(ctx));
router.get('/api/scope-logs/:id', (ctx: KoaContext<any, any>) => logController.getScopeById(ctx));
router.post('/api/logs', (ctx: KoaContext<any, any>) => logController.addLogs(ctx));

router.get('/api/commands', (ctx: KoaContext<any, any>) => commandController.searchCommands(ctx));

export default router;
