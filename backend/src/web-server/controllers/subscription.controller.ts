import { KoaContext } from '../koa';
import { ExternalSubscriptionDTO, SubscriptionDTO } from '../../../../shared/model/subscription.model';

export default class SubscriptionController {
  async getNorthSubscriptions(ctx: KoaContext<void, Array<SubscriptionDTO>>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const subscriptions = ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions(ctx.params.northId);
    ctx.ok(subscriptions);
  }

  async getExternalNorthSubscriptions(ctx: KoaContext<void, Array<ExternalSubscriptionDTO>>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const subscriptions = ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions(ctx.params.northId);
    ctx.ok(subscriptions);
  }

  async createNorthSubscription(ctx: KoaContext<void, SubscriptionDTO>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }

    if (ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription(ctx.params.northId, ctx.params.southId)) {
      return ctx.throw(409, 'Subscription already exists');
    }

    await ctx.app.reloadService.onCreateNorthSubscription(ctx.params.northId, ctx.params.southId);
    return ctx.noContent();
  }

  async createExternalNorthSubscription(ctx: KoaContext<void, ExternalSubscriptionDTO>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const externalSource = ctx.app.repositoryService.externalSourceRepository.getExternalSource(ctx.params.externalSourceId);
    if (!externalSource) {
      return ctx.notFound();
    }

    if (ctx.app.repositoryService.subscriptionRepository.checkExternalNorthSubscription(ctx.params.northId, ctx.params.externalSourceId)) {
      return ctx.throw(409, 'Subscription already exists');
    }

    await ctx.app.reloadService.onCreateExternalNorthSubscription(ctx.params.northId, ctx.params.externalSourceId);
    return ctx.noContent();
  }

  async deleteNorthSubscription(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const southConnector = ctx.app.repositoryService.southConnectorRepository.getSouthConnector(ctx.params.southId);
    if (!southConnector) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.onDeleteNorthSubscription(ctx.params.northId, ctx.params.southId);
    return ctx.noContent();
  }

  async deleteExternalNorthSubscription(ctx: KoaContext<void, void>): Promise<void> {
    const northConnector = ctx.app.repositoryService.northConnectorRepository.getNorthConnector(ctx.params.northId);
    if (!northConnector) {
      return ctx.notFound();
    }

    const externalSource = ctx.app.repositoryService.externalSourceRepository.getExternalSource(ctx.params.externalSourceId);
    if (!externalSource) {
      return ctx.notFound();
    }

    await ctx.app.reloadService.onDeleteExternalNorthSubscription(ctx.params.northId, ctx.params.externalSourceId);
    return ctx.noContent();
  }
}
