import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { toEngineSettingsDTO } from '../../service/oibus.service';

export default class EngineController extends AbstractController {
  async getEngineSettings(ctx: KoaContext<void, EngineSettingsDTO>): Promise<void> {
    const settings = ctx.app.oIBusService.getEngineSettings();
    ctx.ok(toEngineSettingsDTO(settings));
  }

  async updateEngineSettings(ctx: KoaContext<EngineSettingsCommandDTO, void>): Promise<void> {
    await ctx.app.oIBusService.updateEngineSettings(ctx.request.body as EngineSettingsCommandDTO);
    ctx.noContent();
  }

  async resetEngineMetrics(ctx: KoaContext<void, void>): Promise<void> {
    ctx.app.oIBusService.resetMetrics();
    ctx.noContent();
  }

  async restart(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.oIBusService.restartOIBus();
    ctx.noContent();
  }

  async shutdown(ctx: KoaContext<void, void>): Promise<void> {
    await ctx.app.oIBusService.stopOIBus();
    ctx.noContent();
  }

  async getOIBusInfo(ctx: KoaContext<void, OIBusInfo>): Promise<void> {
    const oibusInfo = ctx.app.oIBusService.getOIBusInfo();
    ctx.ok(oibusInfo);
  }

  async getStatus(ctx: KoaContext<void, void>): Promise<void> {
    ctx.ok();
  }
}
