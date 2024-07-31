import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { getOIBusInfo } from '../../service/utils';

export default class EngineController extends AbstractController {
  async getEngineSettings(ctx: KoaContext<void, EngineSettingsDTO>): Promise<void> {
    const settings = ctx.app.repositoryService.engineRepository.get();
    if (settings) {
      settings.logParameters.loki.password = '';
      ctx.ok(settings);
    } else {
      ctx.notFound();
    }
  }

  async updateEngineSettings(ctx: KoaContext<EngineSettingsCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const command = ctx.request.body as EngineSettingsCommandDTO;
      const oldEngineSettings = ctx.app.repositoryService.engineRepository.get()!;
      if (!command.logParameters.loki.password) {
        command.logParameters.loki.password = oldEngineSettings.logParameters.loki.password;
      } else {
        command.logParameters.loki.password = await ctx.app.encryptionService.encryptText(command.logParameters.loki.password);
      }
      ctx.app.repositoryService.engineRepository.update(command);
      const newEngineSettings = ctx.app.repositoryService.engineRepository.get();
      await ctx.app.reloadService.onUpdateOIBusSettings(oldEngineSettings, newEngineSettings!);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async resetEngineMetrics(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.engineMetricsService.resetMetrics();
    ctx.noContent();
  }

  async restart(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.logger.info('Restarting OIBus');
    await ctx.app.oibusService.restartOIBus();
    ctx.noContent();
  }

  async shutdown(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.logger.info('Shutting down OIBus');
    await ctx.app.oibusService.stopOIBus();
    ctx.noContent();
  }

  async getOIBusInfo(ctx: KoaContext<void, OIBusInfo>): Promise<void> {
    const engineSettings = ctx.app.repositoryService.engineRepository.get()!;
    const oibusInfo = getOIBusInfo(engineSettings);
    ctx.ok(oibusInfo);
  }

  async getStatus(ctx: KoaContext<void, void>): Promise<void> {
    ctx.ok();
  }
}
