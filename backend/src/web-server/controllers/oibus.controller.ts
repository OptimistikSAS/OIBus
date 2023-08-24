import { KoaContext } from '../koa';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../../shared/model/engine.model';
import AbstractController from './abstract.controller';

export default class OibusController extends AbstractController {
  async getEngineSettings(ctx: KoaContext<void, EngineSettingsDTO>): Promise<void> {
    const settings = ctx.app.repositoryService.engineRepository.getEngineSettings();
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
      const oldEngineSettings = ctx.app.repositoryService.engineRepository.getEngineSettings()!;
      if (!command.logParameters.loki.password) {
        command.logParameters.loki.password = oldEngineSettings.logParameters.loki.password;
      } else {
        command.logParameters.loki.password = await ctx.app.encryptionService.encryptText(command.logParameters.loki.password);
      }
      ctx.app.repositoryService.engineRepository.updateEngineSettings(command);
      const newEngineSettings = ctx.app.repositoryService.engineRepository.getEngineSettings();
      await ctx.app.reloadService.onUpdateOibusSettings(oldEngineSettings, newEngineSettings!);
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
    const oibusInfo = ctx.app.oibusService.getOIBusInfo();
    ctx.ok(oibusInfo);
  }

  async addValues(ctx: KoaContext<void, void>): Promise<void> {
    const { name } = ctx.request.query;
    if (name && Array.isArray(ctx.request.body)) {
      const externalSource = ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference(name as string);
      if (!externalSource) {
        ctx.app.logger.info(`External source "${name}" not found`);
        return ctx.badRequest();
      }

      try {
        await ctx.app.oibusService.addValues(externalSource.id, ctx.request.body);
        return ctx.noContent();
      } catch (error) {
        return ctx.internalServerError();
      }
    }
    return ctx.badRequest();
  }

  async addFile(ctx: KoaContext<void, void>): Promise<void> {
    const { name } = ctx.request.query;
    const file = ctx.request.file;
    if (name && file) {
      const externalSource = ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference(name as string);
      if (!externalSource) {
        ctx.app.logger.info(`External source "${name}" not found`);
        return ctx.badRequest();
      }

      try {
        await ctx.app.oibusService.addFile(externalSource.id, ctx.request.file.path);
        return ctx.noContent();
      } catch (error) {
        return ctx.internalServerError();
      }
    }
    return ctx.badRequest();
  }
}
