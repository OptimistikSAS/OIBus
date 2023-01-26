import { Context, Request } from 'koa';
import RepositoryService from '../service/repository.service';
import pino from 'pino';
import Logger = pino.Logger;
import * as Application from 'koa';
import ValidatorService from '../service/validator.service';

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
}

interface KoaApplication extends Application {
  id: string;
  repositoryService: RepositoryService;
  validatorService: ValidatorService;
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
