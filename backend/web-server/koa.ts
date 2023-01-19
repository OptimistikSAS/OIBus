import { Context, Request } from "koa";
import RepositoryService from "../service/repository.service";
import LoggerService from "../service/logger/logger.service";
import pino from "pino";
import Logger = pino.Logger;

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
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
  throw: any;
  app: {
    id: string;
    repositoryService: RepositoryService;
    logger: Logger;
  };
}

export interface KoaResponseContext<ResponseBody>
  extends KoaContext<any, ResponseBody> {}
