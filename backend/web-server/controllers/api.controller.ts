import { KoaContext } from "../koa";
import {
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
} from "../../model/engine.model";

const getEngineSettings = async (ctx: KoaContext<void, EngineSettingsDTO>) => {
  const settings =
    ctx.app.repositoryService.engineRepository.getEngineSettings();
  ctx.ok(settings);
};

const updateEngineSettings = async (
  ctx: KoaContext<EngineSettingsCommandDTO, void>
) => {
  ctx.app.repositoryService.engineRepository.updateEngineSettings(
    ctx.request.body
  );
  ctx.noContent();
};

export default {
  getEngineSettings,
  updateEngineSettings,
};
