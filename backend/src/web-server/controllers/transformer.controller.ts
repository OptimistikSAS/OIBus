import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import {
  CustomTransformerCommand,
  TransformerDTO,
  TransformerLightDTO,
  TransformerSearchParam
} from '../../../shared/model/transformer.model';
import { toTransformerDTO, toTransformerLightDTO } from '../../service/transformer.service';
import { Page } from '../../../shared/model/types';
import { OIBusDataType } from '../../../shared/model/engine.model';

export default class TransformerController extends AbstractController {
  async search(ctx: KoaContext<void, Page<TransformerLightDTO>>): Promise<void> {
    const searchParams: TransformerSearchParam = {
      type: ctx.query.type as 'standard' | 'custom',
      inputType: ctx.query.inputType as OIBusDataType,
      outputType: ctx.query.outputType as OIBusDataType,
      name: ctx.query.name as string
    };

    const page = ctx.app.transformerService.search(searchParams);
    ctx.ok({
      content: page.content.map(transformer => toTransformerLightDTO(transformer)),
      totalElements: page.totalElements,
      size: page.size,
      number: page.number,
      totalPages: page.totalPages
    });
  }

  async findAll(ctx: KoaContext<void, Array<TransformerLightDTO>>): Promise<void> {
    const result = ctx.app.transformerService.findAll();
    ctx.ok(result.map(element => toTransformerLightDTO(element)));
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
      ctx.created(toTransformerLightDTO(transformer));
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
