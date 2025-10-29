import { KoaContext } from '../koa';
import { Page } from '../../../shared/model/types';
import AbstractController from './abstract.controller';
import { CommandSearchParam, OIBusCommandDTO, OIBusCommandStatus } from '../../../shared/model/command.model';
import OIAnalyticsCommandService, { toOIBusCommandDTO } from '../../service/oia/oianalytics-command.service';
import JoiValidator from './validators/joi.validator';
import Joi from 'joi';

export default class OIAnalyticsCommandController extends AbstractController {
  constructor(
    protected readonly validator: JoiValidator,
    protected readonly schema: Joi.ObjectSchema,
    private oIAnalyticsCommandService: OIAnalyticsCommandService
  ) {
    super(validator, schema);
  }

  async search(ctx: KoaContext<void, Page<OIBusCommandDTO>>): Promise<void> {
    const types: Array<string> = Array.isArray(ctx.query.types) ? ctx.query.types : [];
    const status: Array<OIBusCommandStatus> = Array.isArray(ctx.query.status) ? (ctx.query.status as Array<OIBusCommandStatus>) : [];
    if (typeof ctx.query.types === 'string') {
      types.push(ctx.query.types);
    }
    if (typeof ctx.query.status === 'string') {
      status.push(ctx.query.status as OIBusCommandStatus);
    }

    const searchParams: CommandSearchParam = {
      types,
      status
    };

    const page = this.oIAnalyticsCommandService.search(searchParams, ctx.query.page ? parseInt(ctx.query.page as string, 10) : 0);
    ctx.ok({
      content: page.content.map(command => toOIBusCommandDTO(command)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      this.oIAnalyticsCommandService.delete(ctx.params.id!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
