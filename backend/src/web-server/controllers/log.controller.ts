import { KoaContext } from '../koa';
import { Page } from '../../../../shared/model/types';
import { LogDTO, LogSearchParam, LogStreamCommandDTO, Scope } from '../../../../shared/model/logs.model';
import { DateTime } from 'luxon';
import AbstractController from './abstract.controller';

export default class LogsConnectorController extends AbstractController {
  async search(ctx: KoaContext<void, Page<LogDTO>>): Promise<void> {
    const now = DateTime.now().toMillis();
    const dayAgo = new Date(now - 86400000);

    const levels = Array.isArray(ctx.query.levels) ? ctx.query.levels : [];
    if (typeof ctx.query.levels === 'string') {
      levels.push(ctx.query.levels);
    }

    const scopeIds = Array.isArray(ctx.query.scopeIds) ? ctx.query.scopeIds : [];
    if (typeof ctx.query.scopeIds === 'string') {
      scopeIds.push(ctx.query.scopeIds);
    }

    const scopeTypes = Array.isArray(ctx.query.scopeTypes) ? ctx.query.scopeTypes : [];
    if (typeof ctx.query.scopeTypes === 'string') {
      scopeTypes.push(ctx.query.scopeTypes);
    }

    const searchParams: LogSearchParam = {
      page: ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0,
      start: (ctx.query.start as string) || new Date(dayAgo).toISOString(),
      end: (ctx.query.end as string) || new Date(now).toISOString(),
      levels,
      scopeIds,
      scopeTypes,
      messageContent: (ctx.query.messageContent as string) || null
    };

    const logs = ctx.app.repositoryService.logRepository.search(searchParams);
    ctx.ok(logs);
  }

  async suggestScopes(ctx: KoaContext<void, Array<Scope>>): Promise<void> {
    const scopes = ctx.app.repositoryService.logRepository.searchScopesByName(ctx.query.name as string);
    ctx.ok(scopes);
  }

  async getScopeById(ctx: KoaContext<void, Scope>): Promise<void> {
    const scope = ctx.app.repositoryService.logRepository.getScopeById(ctx.params.id);
    if (scope) {
      ctx.ok(scope);
    } else {
      ctx.noContent();
    }
  }

  async addLogs(ctx: KoaContext<LogStreamCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const command: LogStreamCommandDTO = ctx.request.body as LogStreamCommandDTO;

      command.streams.forEach(myStream => {
        myStream?.values.forEach(value => {
          const formattedLog = {
            oibus: myStream.stream.oibus,
            time: new Date(parseInt(value[0]) / 1000000),
            scopeType: myStream.stream.scopeType,
            scopeId: myStream.stream.scopeId,
            scopeName: myStream.stream.scopeName,
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
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
