import { KoaContext } from '../koa';
import { Page } from '../../../../shared/model/types';
import { LogDTO, LogSearchParam, LogStreamCommandDTO } from '../../../../shared/model/logs.model';

const searchLogs = async (ctx: KoaContext<void, Page<LogDTO>>) => {
  const now = Date.now();
  const dayAgo = new Date(now - 86400000);

  const levels = Array.isArray(ctx.query.levels) ? ctx.query.levels : [];
  if (typeof ctx.query.levels === 'string') {
    levels.push(ctx.query.levels);
  }

  const searchParams: LogSearchParam = {
    page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
    start: ctx.query.start || new Date(dayAgo).toISOString(),
    end: ctx.query.end || new Date(now).toISOString(),
    levels,
    scope: (ctx.query.scope as string) || null,
    messageContent: (ctx.query.messageContent as string) || null
  };
  const externalSources = ctx.app.repositoryService.logRepository.searchLogs(searchParams);
  ctx.ok(externalSources);
};

const addLogs = async (ctx: KoaContext<LogStreamCommandDTO, void>) => {
  const command: LogStreamCommandDTO | undefined = ctx.request.body;
  if (command) {
    command.streams.forEach(myStream => {
      myStream?.values.forEach(value => {
        const formattedLog = {
          oibus: myStream.stream.oibus,
          time: new Date(parseInt(value[0]) / 1000000),
          scope: myStream.stream.scope,
          msg: value[1]
        };
        switch (myStream.stream.level) {
          case 'trace':
            ctx.app.logger.trace(formattedLog);
            break;

          case 'debug':
            ctx.app.logger.debug(formattedLog);
            break;

          case 'info':
            ctx.app.logger.info(formattedLog);
            break;

          case 'warn':
            ctx.app.logger.warn(formattedLog);
            break;

          case 'error':
            ctx.app.logger.error(formattedLog);
            break;
        }
      });
    });
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

export default {
  searchLogs,
  addLogs
};
