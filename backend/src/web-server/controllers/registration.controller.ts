import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';

export default class RegistrationController extends AbstractController {
  async getRegistrationSettings(ctx: KoaContext<void, RegistrationSettingsDTO>): Promise<RegistrationSettingsDTO> {
    const registrationSettings = ctx.app.oibusService.getRegistrationSettings();
    if (!registrationSettings) {
      return ctx.notFound();
    }
    registrationSettings.token = '';
    registrationSettings.proxyPassword = '';
    return ctx.ok(registrationSettings);
  }

  async updateRegistrationSettings(ctx: KoaContext<RegistrationSettingsCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const command = ctx.request.body as RegistrationSettingsCommandDTO;
      await ctx.app.oibusService.updateRegistrationSettings(command);
      return ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  unregister(ctx: KoaContext<any, any>) {
    ctx.app.oibusService.unregister();
    return ctx.noContent();
  }
}
