import { KoaContext } from '../koa';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import ReloadService from '../../service/reload.service';
import OIBusService from '../../service/oibus.service';
import NorthService from '../../service/north.service';
import SouthService from '../../service/south.service';
import EngineMetricsService from '../../service/engine-metrics.service';
import OianalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import SouthConnectorConfigService from '../../service/south-connector-config.service';
import ScanModeService from '../../service/scan-mode.service';
import NorthConnectorConfigService from '../../service/north-connector-config.service';

/**
 * OIBus middleware for Koa
 */
const oibus = (
  id: string,
  scanModeService: ScanModeService,
  repositoryService: RepositoryService,
  reloadService: ReloadService,
  registrationService: OianalyticsRegistrationService,
  encryptionService: EncryptionService,
  southService: SouthService,
  northService: NorthService,
  oibusService: OIBusService,
  engineMetricsService: EngineMetricsService,
  southConnectorConfigService: SouthConnectorConfigService,
  northConnectorConfigService: NorthConnectorConfigService,
  logger: pino.Logger
) => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
    ctx.app.id = id;
    ctx.app.scanModeService = scanModeService;
    ctx.app.repositoryService = repositoryService;
    ctx.app.reloadService = reloadService;
    ctx.app.registrationService = registrationService;
    ctx.app.encryptionService = encryptionService;
    ctx.app.southService = southService;
    ctx.app.northService = northService;
    ctx.app.oibusService = oibusService;
    ctx.app.engineMetricsService = engineMetricsService;
    ctx.app.southConnectorConfigService = southConnectorConfigService;
    ctx.app.northConnectorConfigService = northConnectorConfigService;
    ctx.app.logger = logger;
    return next();
  };
};

export default oibus;
