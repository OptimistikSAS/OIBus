import Koa, { Context, Request } from 'koa';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import SouthService from '../service/south.service';
import OIBusService from '../service/oibus.service';
import NorthService from '../service/north.service';
import OianalyticsRegistrationService from '../service/oia/oianalytics-registration.service';
import ScanModeService from '../service/scan-mode.service';
import IPFilterService from '../service/ip-filter.service';
import OIAnalyticsCommandService from '../service/oia/oianalytics-command.service';
import HistoryQueryService from '../service/history-query.service';
import HomeMetricsService from '../service/metrics/home-metrics.service';
import UserService from '../service/user.service';
import CertificateService from '../service/certificate.service';
import LogService from '../service/log.service';

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
}

export interface KoaApplication extends Koa {
  id: string;
  scanModeService: ScanModeService;
  ipFilterService: IPFilterService;
  certificateService: CertificateService;
  logService: LogService;
  oIBusService: OIBusService;
  oIAnalyticsRegistrationService: OianalyticsRegistrationService;
  oIAnalyticsCommandService: OIAnalyticsCommandService;
  southService: SouthService;
  northService: NorthService;
  historyQueryService: HistoryQueryService;
  homeMetricsService: HomeMetricsService;
  whiteList: Array<string>;
  encryptionService: EncryptionService;
  userService: UserService;
  logger: pino.Logger;
}

export interface KoaContext<RequestBody, ResponseBody> extends Context {
  request: KoaRequest<RequestBody>;
  body: ResponseBody;
  params: Record<string, string>;
  query: Record<string, string | Array<string>>;
  ok(result: object | string | void): void;
  noContent(): void;
  created(result: object): void;
  badRequest(error: string): void;
  internalServerError(): void;
  notFound(): void;
  throw(message: string, code?: number, properties?: object): never;
  throw(status: number): never;
  throw(...properties: Array<number | string | object>): never;
  app: KoaApplication;
}
