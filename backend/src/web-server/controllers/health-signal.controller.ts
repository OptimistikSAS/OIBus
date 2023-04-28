import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';

export default class HealthSignalController extends AbstractController {
  async healthSignal(ctx: KoaContext<void, void>): Promise<void> {
    try {
      // TODO: validate
      await ctx.app.healthSignalService.forwardRequest(ctx.request.body);
      return ctx.noContent();
    } catch (error) {
      return ctx.internalServerError();
    }
  }
}
