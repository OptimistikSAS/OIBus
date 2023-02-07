import Koa, { Context, Request } from 'koa';
import RepositoryService from '../service/repository.service';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import Logger = pino.Logger;

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
}

export interface KoaApplication extends Koa {
  id: string;
  repositoryService: RepositoryService;
  encryptionService: EncryptionService;
  logger: Logger;
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
