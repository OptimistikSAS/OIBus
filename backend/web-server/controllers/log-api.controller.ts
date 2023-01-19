import { KoaContext } from "../koa";
import { Page } from "../../model/types";
import {
  LogDTO,
  LogSearchParam,
  LogStreamCommandDTO,
} from "../../model/logs.model";

const searchLogs = async (ctx: KoaContext<void, Page<LogDTO>>) => {
  const now = Date.now();
  const dayAgo = new Date(now - 86400000);

  const searchParams: LogSearchParam = {
    page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
    start: ctx.query.start || new Date(dayAgo).toISOString(),
    end: ctx.query.end || new Date(now).toISOString(),
    levels: ctx.query.levels || ["error", "warning", "info"],
    scope: (ctx.query.scope as string) || null,
    messageContent: (ctx.query.messageContent as string) || null,
  };
  const externalSources =
    ctx.app.repositoryService.logRepository.searchLogs(searchParams);
  ctx.ok(externalSources);
};

const addLogs = async (ctx: KoaContext<LogStreamCommandDTO, void>) => {
  ctx.request.body.streams.forEach((myStream) => {
    myStream?.values.forEach((value) => {
      const formattedLog = {
        oibus: myStream.stream.oibus,
        time: new Date(value[0] / 1000000),
        scope: `${myStream.stream.oibus}:${myStream.stream.scope}`,
        msg: value[1],
      };
      switch (myStream.stream.level) {
        case "trace":
          ctx.app.logger.trace(formattedLog);
          break;

        case "debug":
          ctx.app.logger.debug(formattedLog);
          break;

        case "info":
          ctx.app.logger.info(formattedLog);
          break;

        case "warn":
          ctx.app.logger.warn(formattedLog);
          break;

        case "error":
          ctx.app.logger.error(formattedLog);
          break;

        default:
          ctx.app.logger.warn(formattedLog);
          break;
      }
    });
  });
  ctx.noContent();
};

export default {
  searchLogs,
  addLogs,
};
