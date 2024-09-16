import { KoaContext } from '../koa';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import ReloadService from '../../service/reload.service';
import OIBusService from '../../service/oibus.service';
import NorthService from '../../service/north.service';
import SouthService from '../../service/south.service';
import SouthConnectorConfigService from '../../service/south-connector-config.service';
import ScanModeService from '../../service/scan-mode.service';
import NorthConnectorConfigService from '../../service/north-connector-config.service';
import SubscriptionService from '../../service/subscription.service';
import IPFilterService from '../../service/ip-filter.service';
import OIAnalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import OIAnalyticsCommandService from '../../service/oia/oianalytics-command.service';

/**
 * OIBus middleware for Koa
 */
const oibus = (
  id: string,
  scanModeService: ScanModeService,
  subscriptionService: SubscriptionService,
  ipFilterService: IPFilterService,
  oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
  oIAnalyticsCommandService: OIAnalyticsCommandService,
  oibusService: OIBusService,
  repositoryService: RepositoryService,
  reloadService: ReloadService,
  encryptionService: EncryptionService,
  southService: SouthService,
  northService: NorthService,
  southConnectorConfigService: SouthConnectorConfigService,
  northConnectorConfigService: NorthConnectorConfigService,
  logger: pino.Logger
) => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
    ctx.app.id = id;
    ctx.app.scanModeService = scanModeService;
    ctx.app.subscriptionService = subscriptionService;
    ctx.app.ipFilterService = ipFilterService;
    ctx.app.oIAnalyticsRegistrationService = oIAnalyticsRegistrationService;
    ctx.app.oIAnalyticsCommandService = oIAnalyticsCommandService;
    ctx.app.oIBusService = oibusService;
    ctx.app.repositoryService = repositoryService;
    ctx.app.reloadService = reloadService;
    ctx.app.encryptionService = encryptionService;
    ctx.app.southService = southService;
    ctx.app.northService = northService;
    ctx.app.southConnectorConfigService = southConnectorConfigService;
    ctx.app.northConnectorConfigService = northConnectorConfigService;
    ctx.app.logger = logger;
    return next();
  };
};

export default oibus;
