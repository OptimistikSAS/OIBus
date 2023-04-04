import SubscriptionController from './subscription.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

const subscriptionController = new SubscriptionController();

const ctx = new KoaContextMock();
describe('Subscription controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('getNorthSubscriptions() should return proxies', async () => {
    const northId = 'northId';

    ctx.params.northId = northId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions.mockReturnValue(['south1', 'south2']);

    await subscriptionController.getNorthSubscriptions(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions).toHaveBeenCalledWith(northId);
    expect(ctx.ok).toHaveBeenCalledWith(['south1', 'south2']);
  });

  it('getNorthSubscriptions() should return not found', async () => {
    const northId = 'northId';

    ctx.params.northId = northId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await subscriptionController.getNorthSubscriptions(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createNorthSubscription() should create subscription', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue({ id: southId });
    ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription.mockReturnValue(false);

    await subscriptionController.createNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith(southId);
    expect(ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.app.reloadService.onCreateNorthSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('createNorthSubscription() return not found when North is not found', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await subscriptionController.createNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createNorthSubscription() return not found when South is not found', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await subscriptionController.createNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith(southId);
    expect(ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createNorthSubscription() return bad request when subscription already exists', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue({ id: southId });
    ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription.mockReturnValue(true);

    await subscriptionController.createNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith(southId);
    expect(ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.app.reloadService.onCreateNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(409, 'Subscription already exists');
  });

  it('deleteNorthSubscription() should delete subscription', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue({ id: southId });

    await subscriptionController.deleteNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith(southId);
    expect(ctx.app.reloadService.onDeleteNorthSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteNorthSubscription() should return not found when North is not found', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await subscriptionController.deleteNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onDeleteNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('deleteNorthSubscription() should return not found when South is not found', async () => {
    const northId = 'northId';
    const southId = 'southId';

    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await subscriptionController.deleteNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith(southId);
    expect(ctx.app.reloadService.onDeleteNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
