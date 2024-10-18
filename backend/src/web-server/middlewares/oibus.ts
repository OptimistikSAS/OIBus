import { KoaContext } from '../koa';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import OIBusService from '../../service/oibus.service';
import NorthService from '../../service/north.service';
import SouthService from '../../service/south.service';
import ScanModeService from '../../service/scan-mode.service';
import IPFilterService from '../../service/ip-filter.service';
import OIAnalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import OIAnalyticsCommandService from '../../service/oia/oianalytics-command.service';
import HistoryQueryService from '../../service/history-query.service';
import HomeMetricsService from '../../service/metrics/home-metrics.service';

/**
 * OIBus middleware for Koa
 */
const oibus = (
  id: string,
  scanModeService: ScanModeService,
  ipFilterService: IPFilterService,
  oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
  oIAnalyticsCommandService: OIAnalyticsCommandService,
  oibusService: OIBusService,
  southService: SouthService,
  northService: NorthService,
  historyQueryService: HistoryQueryService,
  homeMetricsService: HomeMetricsService,
  repositoryService: RepositoryService,
  encryptionService: EncryptionService,
  logger: pino.Logger
) => {
  return async (ctx: KoaContext<unknown, unknown>, next: () => void) => {
    ctx.app.id = id;
    ctx.app.scanModeService = scanModeService;
    ctx.app.ipFilterService = ipFilterService;
    ctx.app.oIAnalyticsRegistrationService = oIAnalyticsRegistrationService;
    ctx.app.oIAnalyticsCommandService = oIAnalyticsCommandService;
    ctx.app.oIBusService = oibusService;
    ctx.app.southService = southService;
    ctx.app.northService = northService;
    ctx.app.historyQueryService = historyQueryService;
    ctx.app.homeMetricsService = homeMetricsService;
    ctx.app.repositoryService = repositoryService;
    ctx.app.encryptionService = encryptionService;
    ctx.app.logger = logger;
    return next();
  };
};

export default oibus;
