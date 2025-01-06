import { KoaContext } from '../koa';
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
import UserService from '../../service/user.service';
import CertificateService from '../../service/certificate.service';
import LogService from '../../service/log.service';

/**
 * OIBus middleware for Koa
 */
const oibus = (
  id: string,
  scanModeService: ScanModeService,
  ipFilterService: IPFilterService,
  certificateService: CertificateService,
  logService: LogService,
  oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
  oIAnalyticsCommandService: OIAnalyticsCommandService,
  oibusService: OIBusService,
  southService: SouthService,
  northService: NorthService,
  historyQueryService: HistoryQueryService,
  homeMetricsService: HomeMetricsService,
  encryptionService: EncryptionService,
  userService: UserService,
  logger: pino.Logger
) => {
  return async (ctx: KoaContext<unknown, unknown>, next: () => void) => {
    ctx.app.id = id;
    ctx.app.scanModeService = scanModeService;
    ctx.app.ipFilterService = ipFilterService;
    ctx.app.certificateService = certificateService;
    ctx.app.logService = logService;
    ctx.app.oIAnalyticsRegistrationService = oIAnalyticsRegistrationService;
    ctx.app.oIAnalyticsCommandService = oIAnalyticsCommandService;
    ctx.app.oIBusService = oibusService;
    ctx.app.southService = southService;
    ctx.app.northService = northService;
    ctx.app.historyQueryService = historyQueryService;
    ctx.app.homeMetricsService = homeMetricsService;
    ctx.app.encryptionService = encryptionService;
    ctx.app.userService = userService;
    ctx.app.logger = logger;
    return next();
  };
};

export default oibus;
