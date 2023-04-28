import { KoaContext } from '../koa';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../../shared/model/engine.model';
import AbstractController from './abstract.controller';

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
      try {
        await ctx.app.oibusService.addValues(name as string, ctx.request.body);
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
      try {
        await ctx.app.oibusService.addFile(name as string, ctx.request.file.path);
        return ctx.noContent();
      } catch (error) {
        return ctx.internalServerError();
      }
    }
    return ctx.badRequest();
  }
}
