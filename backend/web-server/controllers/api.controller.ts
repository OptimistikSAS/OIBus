import { KoaContext } from '../koa';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../../shared/model/engine.model';
import ValidatorInterface from '../../validators/validator.interface';

export default class ApiController {
  constructor(private readonly validator: ValidatorInterface) {}

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
      await this.validator.validate(ctx.request.body);
      ctx.app.repositoryService.engineRepository.updateEngineSettings(ctx.request.body as EngineSettingsCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }
}
