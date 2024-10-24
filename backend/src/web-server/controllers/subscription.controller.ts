import { KoaContext } from '../koa';
import { SouthConnectorLightDTO } from '../../../shared/model/south-connector.model';
import { toSouthConnectorLightDTO } from '../../service/south.service';

export default class SubscriptionController {
  async findByNorth(ctx: KoaContext<void, Array<SouthConnectorLightDTO>>): Promise<void> {
    try {
      const subscriptions = await ctx.app.northService.findSubscriptionsByNorth(ctx.params.northId);
      return ctx.ok(subscriptions.map(subscription => toSouthConnectorLightDTO(subscription)));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async create(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.createSubscription(ctx.params.northId, ctx.params.southId);
      return ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.northService.deleteSubscription(ctx.params.northId, ctx.params.southId);
      return ctx.noContent();
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  }
}
