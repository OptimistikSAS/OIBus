import { KoaContext } from '../koa';
import { Page } from '../../../shared/model/types';
import { LogDTO, LogSearchParam, LogStreamCommandDTO, Scope } from '../../../shared/model/logs.model';
import { DateTime } from 'luxon';
import AbstractController from './abstract.controller';
import { toLogDTO } from '../../service/log.service';

export default class LogsConnectorController extends AbstractController {
  async search(ctx: KoaContext<void, Page<LogDTO>>): Promise<void> {
    const now = DateTime.now();
    const dayAgo = now.minus({ days: 1 });

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
      start: (ctx.query.start as string) || dayAgo.toUTC().toISO(),
      end: (ctx.query.end as string) || now.toUTC().toISO(),
      levels,
      scopeIds,
      scopeTypes,
      messageContent: (ctx.query.messageContent as string) || null
    };

    const page = ctx.app.logService.search(searchParams);
    ctx.ok({
      content: page.content.map(element => toLogDTO(element)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async suggestScopes(ctx: KoaContext<void, Array<Scope>>): Promise<void> {
    const scopes = ctx.app.logService.searchScopesByName(ctx.query.name as string);
    ctx.ok(scopes);
  }

  async getScopeById(ctx: KoaContext<void, Scope>): Promise<void> {
    const scope = ctx.app.logService.getScopeById(ctx.params.id);
    if (scope) {
      ctx.ok(scope);
    } else {
      ctx.noContent();
    }
  }

  async addLogsFromRemote(ctx: KoaContext<LogStreamCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.logService.addLogsFromRemote(ctx.request.body as LogStreamCommandDTO, ctx.app.logger);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
