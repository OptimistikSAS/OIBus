import { KoaContext } from '../koa';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../../shared/model/engine.model';
import AbstractController from './abstract.controller';

const DELAY_RELOAD = 1000;
const DELAY_SHUTDOWN = 1000;

export default class OibusController extends AbstractController {
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
      const oldEngineSettings = ctx.app.repositoryService.engineRepository.getEngineSettings();
      ctx.app.repositoryService.engineRepository.updateEngineSettings(ctx.request.body as EngineSettingsCommandDTO);
      const newEngineSettings = ctx.app.repositoryService.engineRepository.getEngineSettings();
      await ctx.app.reloadService.onUpdateOibusSettings(oldEngineSettings, newEngineSettings!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async restart(ctx: KoaContext<void, void>): Promise<void> {
    setTimeout(() => {
      // TODO: restart oibus
      ctx.app.logger.info('Restarting OIBus');
      // Ask the Master Cluster to reload
      // process.send({ type: 'reload' });
    }, DELAY_RELOAD);

    ctx.noContent();
  }

  async shutdown(ctx: KoaContext<void, void>): Promise<void> {
    setTimeout(() => {
      // TODO: shutdown oibus
      ctx.app.logger.info('Shutting down OIBus');
      // Ask the Master Cluster to shut down
      // process.send({ type: 'shutdown' });
    }, DELAY_SHUTDOWN);

    ctx.noContent();
  }
}
