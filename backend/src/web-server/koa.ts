import Koa, { Context, Request } from 'koa';
import RepositoryService from '../service/repository.service';
import EncryptionService from '../service/encryption.service';
import ReloadService from '../service/reload.service';
import pino from 'pino';
import SouthService from '../service/south.service';
import OIBusService from '../service/oibus.service';
import NorthService from '../service/north.service';
import EngineMetricsService from '../service/engine-metrics.service';
import OianalyticsRegistrationService from '../service/oia/oianalytics-registration.service';
import SouthConnectorConfigService from '../service/south-connector-config.service';
import ScanModeService from '../service/scan-mode.service';
import NorthConnectorConfigService from '../service/north-connector-config.service';
import SubscriptionService from '../service/subscription.service';
import IPFilterService from '../service/ip-filter.service';

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
}

export interface KoaApplication extends Koa {
  id: string;
  scanModeService: ScanModeService;
  subscriptionService: SubscriptionService;
  ipFilterService: IPFilterService;
  repositoryService: RepositoryService;
  ipFilters: {
    whiteList: Array<string>;
  };
  southService: SouthService;
  northService: NorthService;
  oibusService: OIBusService;
  registrationService: OianalyticsRegistrationService;
  engineMetricsService: EngineMetricsService;
  reloadService: ReloadService;
  encryptionService: EncryptionService;
  scanModeConfigService: ScanModeService;
  southConnectorConfigService: SouthConnectorConfigService;
  northConnectorConfigService: NorthConnectorConfigService;
  logger: pino.Logger;
}

export interface KoaContext<RequestBody, ResponseBody> extends Context {
  request: KoaRequest<RequestBody>;
  body: ResponseBody;
  params: any;
  query: any;
  ok: any;
  noContent: any;
  created: any;
  badRequest: any;
  internalServerError: any;
  notFound: any;
  throw: any;
  app: KoaApplication;
}
