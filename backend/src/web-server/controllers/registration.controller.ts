import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';

export default class RegistrationController extends AbstractController {
  async getRegistrationSettings(ctx: KoaContext<void, RegistrationSettingsDTO>): Promise<RegistrationSettingsDTO> {
    const registrationSettings = ctx.app.repositoryService.registrationRepository.getRegistrationSettings();
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
      await ctx.app.registrationService.updateRegistrationSettings(command);
      return ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async editRegistrationSettings(ctx: KoaContext<RegistrationSettingsCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const command = ctx.request.body as RegistrationSettingsCommandDTO;
      await ctx.app.registrationService.editRegistrationSettings(command);
      return ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async unregister(ctx: KoaContext<any, any>) {
    await ctx.app.registrationService.onUnregister();
    return ctx.noContent();
  }
}
