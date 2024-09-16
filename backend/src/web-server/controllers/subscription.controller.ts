import { KoaContext } from '../koa';
import { SubscriptionDTO } from '../../../../shared/model/subscription.model';
import { toSubscriptionDTO } from '../../service/subscription.service';

export default class SubscriptionController {
  async findByNorth(ctx: KoaContext<void, Array<SubscriptionDTO>>): Promise<void> {
    try {
      const subscriptions = await ctx.app.subscriptionService.findByNorth(ctx.params.northId);
      return ctx.ok(subscriptions.map(subscription => toSubscriptionDTO(subscription)));
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  }

  async create(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.subscriptionService.create(ctx.params.northId, ctx.params.southId);
      return ctx.noContent();
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.subscriptionService.delete(ctx.params.northId, ctx.params.southId);
      return ctx.noContent();
    } catch (error: any) {
      return ctx.badRequest(error.message);
    }
  }
}
