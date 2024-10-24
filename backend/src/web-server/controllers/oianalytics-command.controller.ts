import { KoaContext } from '../koa';
import { Page } from '../../../shared/model/types';
import AbstractController from './abstract.controller';
import { CommandSearchParam, OIBusCommandDTO } from '../../../shared/model/command.model';
import { toOIBusCommandDTO } from '../../service/oia/oianalytics-command.service';

export default class OIAnalyticsCommandController extends AbstractController {
  async search(ctx: KoaContext<void, Page<OIBusCommandDTO>>): Promise<void> {
    const types: Array<string> = Array.isArray(ctx.query.types) ? ctx.query.types : [];
    const status: Array<string> = Array.isArray(ctx.query.status) ? ctx.query.status : [];
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

    const page = ctx.app.oIAnalyticsCommandService.search(searchParams, ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0);
    ctx.ok({
      content: page.content.map(command => toOIBusCommandDTO(command)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }
}
