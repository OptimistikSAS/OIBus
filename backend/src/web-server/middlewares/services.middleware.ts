import { Request, Response, NextFunction } from 'express';
import ScanModeService from '../../service/scan-mode.service';
import CertificateService from '../../service/certificate.service';
import { CustomExpressRequest } from '../express';
import LogService from '../../service/log.service';
import OIBusService from '../../service/oibus.service';
import IPFilterService from '../../service/ip-filter.service';
import OIAnalyticsCommandService from '../../service/oia/oianalytics-command.service';
import OIAnalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import TransformerService from '../../service/transformer.service';
import UserService from '../../service/user.service';
import SouthService from '../../service/south.service';
import HistoryQueryService from '../../service/history-query.service';
import NorthService from '../../service/north.service';

export function createInjectServicesMiddleware(
  certificateService: CertificateService,
  historyQueryService: HistoryQueryService,
  ipFilterService: IPFilterService,
  logService: LogService,
  northService: NorthService,
  oIAnalyticsCommandService: OIAnalyticsCommandService,
  oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
  oIBusService: OIBusService,
  scanModeService: ScanModeService,
  southService: SouthService,
  transformerService: TransformerService,
  userService: UserService
) {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as CustomExpressRequest).services = {
      certificateService,
      historyQueryService,
      ipFilterService,
      logService,
      northService,
      oIAnalyticsCommandService,
      oIAnalyticsRegistrationService,
      oIBusService,
      scanModeService,
      southService,
      transformerService,
      userService
    };
    return next();
  };
}
