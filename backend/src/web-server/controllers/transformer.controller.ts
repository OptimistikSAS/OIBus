import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { CustomTransformerCommand, TransformerDTO, TransformerSearchParam } from '../../../shared/model/transformer.model';
import { toTransformerDTO } from '../../service/transformer.service';
import { Page } from '../../../shared/model/types';
import { OIBusDataType } from '../../../shared/model/engine.model';

export default class TransformerController extends AbstractController {
  async search(ctx: KoaContext<void, Page<TransformerDTO>>): Promise<void> {
    const searchParams: TransformerSearchParam = {
      type: ctx.query.type as 'standard' | 'custom',
      inputType: ctx.query.inputType as OIBusDataType,
      outputType: ctx.query.outputType as OIBusDataType
    };

    const page = ctx.app.transformerService.search(searchParams);
    ctx.ok({
      content: page.content.map(transformer => toTransformerDTO(transformer)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async findAll(ctx: KoaContext<void, Array<TransformerDTO>>): Promise<void> {
    const result = ctx.app.transformerService.findAll();
    ctx.ok(result.map(element => toTransformerDTO(element)));
  }

  async findById(ctx: KoaContext<void, TransformerDTO>): Promise<void> {
    const transformer = ctx.app.transformerService.findById(ctx.params.id);
    if (!transformer) {
      return ctx.notFound();
    }
    ctx.ok(toTransformerDTO(transformer));
  }

  async create(ctx: KoaContext<CustomTransformerCommand, TransformerDTO>): Promise<void> {
    try {
      const transformer = await ctx.app.transformerService.create(ctx.request.body as CustomTransformerCommand);
      ctx.created(toTransformerDTO(transformer));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<CustomTransformerCommand, void>) {
    try {
      await ctx.app.transformerService.update(ctx.params.id, ctx.request.body as CustomTransformerCommand);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.transformerService.delete(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
