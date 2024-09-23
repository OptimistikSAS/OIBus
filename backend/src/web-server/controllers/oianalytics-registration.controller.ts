import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { toOIAnalyticsRegistrationDTO } from '../../service/oia/oianalytics-registration.service';

export default class OIAnalyticsRegistrationController extends AbstractController {
  async get(ctx: KoaContext<void, RegistrationSettingsDTO>): Promise<void> {
    const registrationSettings = ctx.app.oIAnalyticsRegistrationService.getRegistrationSettings();
    if (!registrationSettings) {
      return ctx.notFound();
    }
    return ctx.ok(toOIAnalyticsRegistrationDTO(registrationSettings));
  }

  async register(ctx: KoaContext<RegistrationSettingsCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.oIAnalyticsRegistrationService.register(ctx.request.body!);
      return ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async editConnectionSettings(ctx: KoaContext<RegistrationSettingsCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.oIAnalyticsRegistrationService.editConnectionSettings(ctx.request.body!);
      return ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async unregister(ctx: KoaContext<void, void>) {
    ctx.app.oIAnalyticsRegistrationService.unregister();
    return ctx.noContent();
  }
}
