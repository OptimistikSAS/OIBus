import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import {
  CustomTransformerCommand,
  InputType,
  OutputType,
  TransformerDTO,
  TransformerSearchParam,
  TransformerTestRequest,
  TransformerTestResponse
} from '../../../shared/model/transformer.model';
import { toTransformerDTO } from '../../service/transformer.service';
import { Page } from '../../../shared/model/types';
import InputTemplateService, { InputTemplate } from '../../service/input-template.service';

export default class TransformerController extends AbstractController {
  async search(ctx: KoaContext<void, Page<TransformerDTO>>): Promise<void> {
    const searchParams: TransformerSearchParam = {
      type: ctx.query.type as 'standard' | 'custom',
      inputType: ctx.query.inputType as InputType,
      outputType: ctx.query.outputType as OutputType
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

  async test(ctx: KoaContext<TransformerTestRequest, TransformerTestResponse>): Promise<void> {
    try {
      const result = await ctx.app.transformerService.test(ctx.params.id, ctx.request.body as TransformerTestRequest);
      ctx.ok(result);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async getInputTemplate(ctx: KoaContext<void, InputTemplate>): Promise<void> {
    try {
      const inputType = ctx.query.inputType as InputType;
      if (!inputType) {
        return ctx.badRequest('inputType query parameter is required');
      }

      const templateService = new InputTemplateService();
      const template = templateService.generateTemplate(inputType);
      ctx.ok(template);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
