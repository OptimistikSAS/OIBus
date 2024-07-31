import { KoaContext } from '../koa';
import { Page } from '../../../../shared/model/types';
import { LogDTO } from '../../../../shared/model/logs.model';
import AbstractController from './abstract.controller';
import { CommandSearchParam } from '../../../../shared/model/command.model';

export default class OIAnalyticsCommandController extends AbstractController {
  async search(ctx: KoaContext<void, Page<LogDTO>>): Promise<void> {
    const types = Array.isArray(ctx.query.types) ? ctx.query.types : [];
    const status = Array.isArray(ctx.query.status) ? ctx.query.status : [];
    if (typeof ctx.query.types === 'string') {
      types.push(ctx.query.types);
    }
    if (typeof ctx.query.status === 'string') {
      status.push(ctx.query.status);
    }

    const searchParams: CommandSearchParam = {
      types,
      status
    };

    const logs = ctx.app.repositoryService.oianalyticsCommandRepository.search(
      searchParams,
      ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0
    );
    ctx.ok(logs);
  }
}
