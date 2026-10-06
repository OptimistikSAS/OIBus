import { NextFunction, Request, Response } from 'express';

import AuditService from '../../service/audit.service';
import CertificateService from '../../service/certificate.service';
import ConfigImportService from '../../service/config-transfer/config-import.service';
import ConfigTransferService from '../../service/config-transfer/config-transfer.service';
import ConfigurationWorkflowService from '../../service/configuration-workflow.service';
import ConfigurationWorkflowRunService from '../../service/configuration-workflow-run.service';
import HistoryQueryService from '../../service/history-query.service';
import IPFilterService from '../../service/ip-filter.service';
import LogService from '../../service/log.service';
import NorthService from '../../service/north.service';
import OIAnalyticsCommandService from '../../service/oia/oianalytics-command.service';
import OIAnalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import OIBusService from '../../service/oibus.service';
import ScanModeService from '../../service/scan-mode.service';
import SouthService from '../../service/south.service';
import TransformerService from '../../service/transformer.service';
import UserService from '../../service/user.service';
import { CustomExpressRequest } from '../express';

export function createInjectServicesMiddleware(
  auditService: AuditService,
  certificateService: CertificateService,
  configImportService: ConfigImportService,
  configTransferService: ConfigTransferService,
  configurationWorkflowRunService: ConfigurationWorkflowRunService,
  configurationWorkflowService: ConfigurationWorkflowService,
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
      auditService,
      certificateService,
      configImportService,
      configTransferService,
      configurationWorkflowRunService,
      configurationWorkflowService,
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
