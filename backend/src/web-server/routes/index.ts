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
import { Page } from '../../../../shared/model/types';
import { ChangePasswordCommand, User, UserCommandDTO, UserLight } from '../../../../shared/model/user.model';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { CertificateCommandDTO, CertificateDTO } from '../../../../shared/model/certificate.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthType
} from '../../../../shared/model/south-connector.model';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorLightDTO,
  NorthConnectorManifest,
  NorthType
} from '../../../../shared/model/north-connector.model';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../../shared/model/ip-filter.model';
import {
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
  OIBusContent,
  OIBusInfo,
  RegistrationSettingsCommandDTO,
  RegistrationSettingsDTO
} from '../../../../shared/model/engine.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryLightDTO
} from '../../../../shared/model/history-query.model';
import { LogDTO, LogStreamCommandDTO, Scope } from '../../../../shared/model/logs.model';
import { OIBusCommandDTO } from '../../../../shared/model/command.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';

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

router.get('/api/users', (ctx: KoaContext<void, Page<UserLight>>) => userController.search(ctx));
router.get('/api/users/:id', (ctx: KoaContext<void, User>) => userController.findById(ctx));
router.post('/api/users', (ctx: KoaContext<{ user: UserCommandDTO; password: string }, void>) => userController.create(ctx));
router.put('/api/users/:id', (ctx: KoaContext<UserCommandDTO, void>) => userController.update(ctx));
router.put('/api/users/:id/change-password', (ctx: KoaContext<ChangePasswordCommand, void>) => userController.changePassword(ctx));
router.delete('/api/users/:id', (ctx: KoaContext<void, void>) => userController.delete(ctx));

router.get('/api/scan-modes', (ctx: KoaContext<void, Array<ScanModeDTO>>) => scanModeController.findAll(ctx));
router.post('/api/scan-modes/verify', (ctx: KoaContext<ScanModeCommandDTO, void>) => scanModeController.verifyCron(ctx));
router.get('/api/scan-modes/:id', (ctx: KoaContext<void, ScanModeDTO>) => scanModeController.findById(ctx));
router.post('/api/scan-modes', (ctx: KoaContext<ScanModeCommandDTO, void>) => scanModeController.create(ctx));
router.put('/api/scan-modes/:id', (ctx: KoaContext<ScanModeCommandDTO, void>) => scanModeController.update(ctx));
router.delete('/api/scan-modes/:id', (ctx: KoaContext<void, void>) => scanModeController.delete(ctx));

router.get('/api/certificates', (ctx: KoaContext<void, Array<CertificateDTO>>) => certificateController.findAll(ctx));
router.get('/api/certificates/:id', (ctx: KoaContext<void, CertificateDTO>) => certificateController.findById(ctx));
router.post('/api/certificates', (ctx: KoaContext<CertificateCommandDTO, void>) => certificateController.create(ctx));
router.put('/api/certificates/:id', (ctx: KoaContext<CertificateCommandDTO, void>) => certificateController.update(ctx));
router.delete('/api/certificates/:id', (ctx: KoaContext<void, void>) => certificateController.delete(ctx));

router.get('/api/engine', (ctx: KoaContext<void, EngineSettingsDTO>) => engineController.getEngineSettings(ctx));
router.put('/api/engine', (ctx: KoaContext<EngineSettingsCommandDTO, void>) => engineController.updateEngineSettings(ctx));
router.put('/api/engine/reset-metrics', (ctx: KoaContext<void, void>) => engineController.resetEngineMetrics(ctx));
router.put('/api/restart', (ctx: KoaContext<void, void>) => engineController.restart(ctx));
router.put('/api/shutdown', (ctx: KoaContext<void, void>) => engineController.shutdown(ctx));
router.post('/api/add-content', upload.single('file'), (ctx: KoaContext<OIBusContent, void>) => contentController.addContent(ctx));
router.get('/api/info', (ctx: KoaContext<void, OIBusInfo>) => engineController.getOIBusInfo(ctx));
router.get('/api/status', (ctx: KoaContext<void, void>) => engineController.getStatus(ctx));

router.get('/api/registration', (ctx: KoaContext<void, RegistrationSettingsDTO>) => registrationController.get(ctx));
router.put('/api/registration', (ctx: KoaContext<RegistrationSettingsCommandDTO, void>) => registrationController.register(ctx));
router.put('/api/registration/edit', (ctx: KoaContext<RegistrationSettingsCommandDTO, void>) =>
  registrationController.editConnectionSettings(ctx)
);
router.put('/api/registration/unregister', (ctx: KoaContext<void, void>) => registrationController.unregister(ctx));

router.get('/api/ip-filters', (ctx: KoaContext<void, Array<IPFilterDTO>>) => ipFilterController.findAll(ctx));
router.get('/api/ip-filters/:id', (ctx: KoaContext<void, IPFilterDTO>) => ipFilterController.findById(ctx));
router.post('/api/ip-filters', (ctx: KoaContext<IPFilterCommandDTO, IPFilterDTO>) => ipFilterController.create(ctx));
router.put('/api/ip-filters/:id', (ctx: KoaContext<IPFilterCommandDTO, void>) => ipFilterController.update(ctx));
router.delete('/api/ip-filters/:id', (ctx: KoaContext<void, void>) => ipFilterController.delete(ctx));

router.get('/api/north-types', (ctx: KoaContext<void, Array<NorthType>>) => northConnectorController.getNorthConnectorTypes(ctx));
router.get('/api/north-types/:id', (ctx: KoaContext<void, NorthConnectorManifest>) =>
  northConnectorController.getNorthConnectorManifest(ctx)
);

router.get('/api/north', (ctx: KoaContext<void, Array<NorthConnectorLightDTO>>) => northConnectorController.findAll(ctx));
router.put('/api/north/:id/test-connection', (ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>) =>
  northConnectorController.testNorthConnection(ctx)
);
router.get('/api/north/:id', (ctx: KoaContext<void, NorthConnectorDTO<NorthSettings>>) => northConnectorController.findById(ctx));
router.post('/api/north', (ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, NorthConnectorDTO<NorthSettings>>) =>
  northConnectorController.create(ctx)
);
router.put('/api/north/:id', (ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>) => northConnectorController.updateNorth(ctx));
router.delete('/api/north/:id', (ctx: KoaContext<void, void>) => northConnectorController.delete(ctx));
router.put('/api/north/:id/start', (ctx: KoaContext<void, void>) => northConnectorController.start(ctx));
router.put('/api/north/:id/stop', (ctx: KoaContext<void, void>) => northConnectorController.stop(ctx));
router.get('/api/north/:northId/subscriptions', (ctx: KoaContext<void, Array<SouthConnectorLightDTO>>) =>
  subscriptionController.findByNorth(ctx)
);
router.post('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<void, void>) => subscriptionController.create(ctx));
router.delete('/api/north/:northId/subscriptions/:southId', (ctx: KoaContext<void, void>) => subscriptionController.delete(ctx));
router.get('/api/north/:northId/cache/file-errors', (ctx: KoaContext<void, void>) => northConnectorController.getFileErrors(ctx));
router.get('/api/north/:northId/cache/file-errors/:filename', (ctx: KoaContext<void, void>) =>
  northConnectorController.getFileErrorContent(ctx)
);
router.post('/api/north/:northId/cache/file-errors/remove', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.removeFileErrors(ctx)
);
router.post('/api/north/:northId/cache/file-errors/retry', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.retryErrorFiles(ctx)
);
router.delete('/api/north/:northId/cache/file-errors/remove-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeAllErrorFiles(ctx)
);
router.delete('/api/north/:northId/cache/file-errors/retry-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.retryAllErrorFiles(ctx)
);

router.get('/api/north/:northId/cache/files', (ctx: KoaContext<void, void>) => northConnectorController.getCacheFiles(ctx));
router.get('/api/north/:northId/cache/files/:filename', (ctx: KoaContext<void, void>) => northConnectorController.getCacheFileContent(ctx));
router.post('/api/north/:northId/cache/files/remove', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.removeCacheFiles(ctx)
);
router.post('/api/north/:northId/cache/files/archive', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.archiveCacheFiles(ctx)
);

router.get('/api/north/:northId/cache/archive-files', (ctx: KoaContext<void, void>) => northConnectorController.getArchiveFiles(ctx));
router.get('/api/north/:northId/cache/archive-files/:filename', (ctx: KoaContext<void, void>) =>
  northConnectorController.getArchiveFileContent(ctx)
);
router.post('/api/north/:northId/cache/archive-files/remove', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.removeArchiveFiles(ctx)
);
router.post('/api/north/:northId/cache/archive-files/retry', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.retryArchiveFiles(ctx)
);
router.delete('/api/north/:northId/cache/archive-files/remove-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeAllArchiveFiles(ctx)
);
router.delete('/api/north/:northId/cache/archive-files/retry-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.retryAllArchiveFiles(ctx)
);

router.put('/api/north/:northId/cache/reset-metrics', (ctx: KoaContext<void, void>) => northConnectorController.resetMetrics(ctx));

router.get('/api/north/:northId/cache/values', (ctx: KoaContext<void, void>) => northConnectorController.getCacheValues(ctx));
router.post('/api/north/:northId/cache/values/remove', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.removeCacheValues(ctx)
);
router.delete('/api/north/:northId/cache/values/remove-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeAllCacheValues(ctx)
);

router.get('/api/north/:northId/cache/value-errors', (ctx: KoaContext<void, void>) => northConnectorController.getValueErrors(ctx));
router.post('/api/north/:northId/cache/value-errors/remove', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.removeValueErrors(ctx)
);
router.delete('/api/north/:northId/cache/value-errors/remove-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.removeAllValueErrors(ctx)
);
router.post('/api/north/:northId/cache/value-errors/retry', (ctx: KoaContext<Array<string>, void>) =>
  northConnectorController.retryValueErrors(ctx)
);
router.delete('/api/north/:northId/cache/value-errors/retry-all', (ctx: KoaContext<void, void>) =>
  northConnectorController.retryAllValueErrors(ctx)
);

router.get('/api/south-types', (ctx: KoaContext<void, Array<SouthType>>) => southConnectorController.getSouthConnectorTypes(ctx));
router.get('/api/south-types/:id', (ctx: KoaContext<void, SouthConnectorManifest>) =>
  southConnectorController.getSouthConnectorManifest(ctx)
);

router.get('/api/south', (ctx: KoaContext<void, Array<SouthConnectorLightDTO>>) => southConnectorController.findAll(ctx));
router.put('/api/south/:id/test-connection', (ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>) =>
  southConnectorController.testSouthConnection(ctx)
);
router.get('/api/south/:id', (ctx: KoaContext<void, SouthConnectorDTO<SouthSettings, SouthItemSettings>>) =>
  southConnectorController.findById(ctx)
);
router.post(
  '/api/south',
  (ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, SouthConnectorDTO<SouthSettings, SouthItemSettings>>) =>
    southConnectorController.createSouth(ctx)
);
router.put('/api/south/:id', (ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>) =>
  southConnectorController.updateSouth(ctx)
);
router.delete('/api/south/:id', (ctx: KoaContext<void, void>) => southConnectorController.delete(ctx));
router.put('/api/south/:id/start', (ctx: KoaContext<void, void>) => southConnectorController.start(ctx));
router.put('/api/south/:id/stop', (ctx: KoaContext<void, void>) => southConnectorController.stop(ctx));
router.put(
  '/api/south/:id/items/test-item',
  (
    ctx: KoaContext<
      {
        south: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
        item: SouthConnectorItemCommandDTO<SouthItemSettings>;
      },
      void
    >
  ) => southConnectorController.testSouthItem(ctx)
);
router.get('/api/south/:southId/items', (ctx: KoaContext<void, Page<SouthConnectorItemDTO<SouthItemSettings>>>) =>
  southConnectorController.searchSouthItems(ctx)
);
router.get('/api/south/:southId/items/all', (ctx: KoaContext<void, Array<SouthConnectorItemDTO<SouthItemSettings>>>) =>
  southConnectorController.listSouthItems(ctx)
);
router.post(
  '/api/south/:southId/items',
  (ctx: KoaContext<SouthConnectorItemCommandDTO<SouthItemSettings>, SouthConnectorItemDTO<SouthItemSettings>>) =>
    southConnectorController.createSouthItem(ctx)
);
router.post(
  '/api/south/:southType/items/check-import/:southId',
  upload.single('file'),
  (
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>;
        errors: Array<{ item: SouthConnectorItemCommandDTO<SouthItemSettings>; error: string }>;
      }
    >
  ) => southConnectorController.checkImportSouthItems(ctx)
);
router.post(
  '/api/south/:southId/items/import',
  (ctx: KoaContext<{ items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>> }, void>) =>
    southConnectorController.importSouthItems(ctx)
);
router.put('/api/south/:southId/items/export', (ctx: KoaContext<{ delimiter: string }, string>) =>
  southConnectorController.exportSouthItems(ctx)
);
router.put(
  '/api/south/items/to-csv',
  (ctx: KoaContext<{ items: Array<SouthConnectorItemDTO<SouthItemSettings>>; delimiter: string }, string>) =>
    southConnectorController.southConnectorItemsToCsv(ctx)
);
router.get('/api/south/:southId/items/:id', (ctx: KoaContext<void, SouthConnectorItemDTO<SouthItemSettings>>) =>
  southConnectorController.getSouthItem(ctx)
);
router.put('/api/south/:southId/items/:id', (ctx: KoaContext<SouthConnectorItemCommandDTO<SouthItemSettings>, void>) =>
  southConnectorController.updateSouthItem(ctx)
);
router.put('/api/south/:southId/items/:id/enable', (ctx: KoaContext<void, void>) => southConnectorController.enableSouthItem(ctx));
router.put('/api/south/:southId/items/:id/disable', (ctx: KoaContext<void, void>) => southConnectorController.disableSouthItem(ctx));
router.delete('/api/south/:southId/items/all', (ctx: KoaContext<void, void>) => southConnectorController.deleteAllSouthItem(ctx));
router.delete('/api/south/:southId/items/:id', (ctx: KoaContext<void, void>) => southConnectorController.deleteSouthItem(ctx));
router.put('/api/south/:southId/cache/reset-metrics', (ctx: KoaContext<void, void>) => southConnectorController.resetSouthMetrics(ctx));

router.get('/api/history-queries', (ctx: KoaContext<void, Array<HistoryQueryLightDTO>>) => historyQueryController.findAll(ctx));
router.get('/api/history-queries/:id', (ctx: KoaContext<void, HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>>) =>
  historyQueryController.findById(ctx)
);
router.post(
  '/api/history-queries',
  (
    ctx: KoaContext<
      HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
      HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>
    >
  ) => historyQueryController.createHistoryQuery(ctx)
);
router.put('/api/history-queries/:id/start', (ctx: KoaContext<void, void>) => historyQueryController.startHistoryQuery(ctx));
router.put('/api/history-queries/:id/pause', (ctx: KoaContext<void, void>) => historyQueryController.pauseHistoryQuery(ctx));
router.put('/api/history-queries/:id', (ctx: KoaContext<HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>, void>) =>
  historyQueryController.updateHistoryQuery(ctx)
);
router.delete('/api/history-queries/:id', (ctx: KoaContext<void, void>) => historyQueryController.deleteHistoryQuery(ctx));

router.get('/api/history-queries/:historyQueryId/south-items', (ctx: KoaContext<void, Page<HistoryQueryItemDTO<SouthItemSettings>>>) =>
  historyQueryController.searchHistoryQueryItems(ctx)
);
router.post(
  '/api/history-queries/:southType/south-items/check-south-import/:historyQueryId',
  upload.single('file'),
  (
    ctx: KoaContext<
      { delimiter: string; currentItems: string },
      {
        items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>>;
        errors: Array<{ item: HistoryQueryItemCommandDTO<SouthItemSettings>; error: string }>;
      }
    >
  ) => historyQueryController.checkImportSouthItems(ctx)
);
router.post(
  '/api/history-queries/:historyQueryId/south-items/import',
  (ctx: KoaContext<{ items: Array<HistoryQueryItemCommandDTO<SouthItemSettings>> }, void>) => historyQueryController.importSouthItems(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/export', (ctx: KoaContext<{ delimiter: string }, string>) =>
  historyQueryController.exportSouthItems(ctx)
);
router.put(
  '/api/history-queries/south-items/to-csv',
  (ctx: KoaContext<{ items: Array<HistoryQueryItemDTO<SouthItemSettings>>; delimiter: string }, string>) =>
    historyQueryController.historyQueryItemsToCsv(ctx)
);

router.get('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<void, HistoryQueryItemDTO<SouthItemSettings>>) =>
  historyQueryController.getHistoryQueryItem(ctx)
);
router.post(
  '/api/history-queries/:historyQueryId/south-items',
  (ctx: KoaContext<HistoryQueryItemCommandDTO<SouthItemSettings>, HistoryQueryItemDTO<SouthItemSettings>>) =>
    historyQueryController.createHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<HistoryQueryItemCommandDTO<SouthItemSettings>, void>) =>
  historyQueryController.updateHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id/enable', (ctx: KoaContext<void, void>) =>
  historyQueryController.enableHistoryQueryItem(ctx)
);
router.put('/api/history-queries/:historyQueryId/south-items/:id/disable', (ctx: KoaContext<void, void>) =>
  historyQueryController.disableHistoryQueryItem(ctx)
);
router.delete('/api/history-queries/:historyQueryId/south-items/all', (ctx: KoaContext<void, void>) =>
  historyQueryController.deleteAllItems(ctx)
);
router.delete('/api/history-queries/:historyQueryId/south-items/:id', (ctx: KoaContext<void, void>) =>
  historyQueryController.deleteHistoryQueryItem(ctx)
);
router.put(
  '/api/history-queries/:id/south/test-connection',
  (ctx: KoaContext<SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>, void>) => historyQueryController.testSouthConnection(ctx)
);
router.put('/api/history-queries/:id/north/test-connection', (ctx: KoaContext<NorthConnectorCommandDTO<NorthSettings>, void>) =>
  historyQueryController.testNorthConnection(ctx)
);
router.put(
  '/api/history-queries/:id/south/items/test-item',
  (
    ctx: KoaContext<
      { south: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>; item: HistoryQueryItemCommandDTO<SouthItemSettings> },
      void
    >
  ) => historyQueryController.testHistoryQueryItem(ctx)
);

router.get('/api/logs', (ctx: KoaContext<void, Page<LogDTO>>) => logController.search(ctx));
router.get('/api/scope-logs/suggestions', (ctx: KoaContext<void, Array<Scope>>) => logController.suggestScopes(ctx));
router.get('/api/scope-logs/:id', (ctx: KoaContext<void, Scope>) => logController.getScopeById(ctx));
router.post('/api/logs', (ctx: KoaContext<LogStreamCommandDTO, void>) => logController.addLogs(ctx));

router.get('/api/commands', (ctx: KoaContext<void, Page<OIBusCommandDTO>>) => commandController.search(ctx));

export default router;
