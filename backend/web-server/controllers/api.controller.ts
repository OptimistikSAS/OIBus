import { KoaContext } from '../koa';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../../shared/model/engine.model';

const getEngineSettings = async (ctx: KoaContext<void, EngineSettingsDTO>) => {
  const settings = ctx.app.repositoryService.engineRepository.getEngineSettings();
  ctx.ok(settings);
};

const updateEngineSettings = async (ctx: KoaContext<EngineSettingsCommandDTO, void>) => {
  const command: EngineSettingsCommandDTO | undefined = ctx.request.body;
  if (command) {
    ctx.app.repositoryService.engineRepository.updateEngineSettings(command);
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

export default {
  getEngineSettings,
  updateEngineSettings
};
