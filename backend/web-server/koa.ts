import { Context, Request } from "koa";
import RepositoryService from "../service/repository.service";

interface KoaRequest<RequestBody> extends Request {
  body?: RequestBody;
}

export interface KoaContext<RequestBody, ResponseBody> extends Context {
  request: KoaRequest<RequestBody>;
  body: ResponseBody;
  params: any;
  ok: any;
  app: {
    id: string;
    repositoryService: RepositoryService;
  };
}

export interface KoaResponseContext<ResponseBody>
  extends KoaContext<any, ResponseBody> {}
