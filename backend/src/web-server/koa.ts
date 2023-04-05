import Koa, { Context, Request } from 'koa';
import RepositoryService from '../service/repository.service';
import EncryptionService from '../service/encryption.service';
import ReloadService from '../service/reload.service';
import pino from 'pino';
import SouthService from '../service/south.service';
import OIBusService from '../service/oibus.service';
import NorthService from '../service/north.service';

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
}

export interface KoaApplication extends Koa {
  id: string;
  repositoryService: RepositoryService;
  southService: SouthService;
  northService: NorthService;
  oibusService: OIBusService;
  reloadService: ReloadService;
  encryptionService: EncryptionService;
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
  notFound: any;
  throw: any;
  app: KoaApplication;
}
