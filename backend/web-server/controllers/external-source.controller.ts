import { KoaContext } from '../koa';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../../shared/model/external-sources.model';
import AbstractController from './abstract.controller';

export default class ExternalSourceController extends AbstractController {
  async getExternalSources(ctx: KoaContext<void, Array<ExternalSourceDTO>>): Promise<void> {
    const externalSources = ctx.app.repositoryService.externalSourceRepository.getExternalSources();
    ctx.ok(externalSources);
  }

  async getExternalSource(ctx: KoaContext<void, ExternalSourceDTO>): Promise<void> {
    const externalSource = ctx.app.repositoryService.externalSourceRepository.getExternalSource(ctx.params.id);
    if (externalSource) {
      ctx.ok(externalSource);
    } else {
      ctx.notFound();
    }
  }

  async createExternalSource(ctx: KoaContext<ExternalSourceCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const externalSource = ctx.app.repositoryService.externalSourceRepository.createExternalSource(
        ctx.request.body as ExternalSourceCommandDTO
      );
      ctx.created(externalSource);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateExternalSource(ctx: KoaContext<ExternalSourceCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.externalSourceRepository.updateExternalSource(ctx.params.id, ctx.request.body as ExternalSourceCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteExternalSource(ctx: KoaContext<void, void>): Promise<void> {
    const externalSource = ctx.app.repositoryService.externalSourceRepository.getExternalSource(ctx.params.id);
    if (externalSource) {
      ctx.app.repositoryService.externalSourceRepository.deleteExternalSource(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
