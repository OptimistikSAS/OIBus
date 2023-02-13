import { KoaContext } from '../koa';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../../shared/model/engine.model';
import AbstractController from './abstract.controller';

export default class ApiController extends AbstractController {
  async getEngineSettings(ctx: KoaContext<void, EngineSettingsDTO>): Promise<void> {
    const settings = ctx.app.repositoryService.engineRepository.getEngineSettings();
    if (settings) {
      ctx.ok(settings);
    } else {
      ctx.notFound();
    }
  }

  async updateEngineSettings(ctx: KoaContext<EngineSettingsCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.engineRepository.updateEngineSettings(ctx.request.body as EngineSettingsCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }
}
