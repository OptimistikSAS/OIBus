import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { TransformerDTO, TransformerCommandDTO } from '../../../../shared/model/transformer.model';

export default class TransformerController extends AbstractController {
  async getTransformers(ctx: KoaContext<void, Array<TransformerDTO>>): Promise<void> {
    const transformers = ctx.app.repositoryService.transformerRepository.getTransformers();
    ctx.ok(transformers);
  }

  async getTransformer(ctx: KoaContext<void, TransformerDTO>): Promise<void> {
    const transformer = ctx.app.repositoryService.transformerRepository.getTransformer(ctx.params.id);
    if (transformer) {
      ctx.ok(transformer);
    } else {
      ctx.notFound();
    }
  }

  async createTransformer(ctx: KoaContext<TransformerCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const transformer = ctx.app.repositoryService.transformerRepository.createTransformer(ctx.request.body as TransformerCommandDTO);

      ctx.created(transformer);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateTransformer(ctx: KoaContext<TransformerCommandDTO, void>) {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.transformerRepository.updateTransformer(ctx.params.id, ctx.request.body as TransformerCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteTransformer(ctx: KoaContext<void, void>): Promise<void> {
    const transformer = ctx.app.repositoryService.transformerRepository.getTransformer(ctx.params.id);
    if (transformer) {
      ctx.app.repositoryService.transformerRepository.deleteTransformer(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
