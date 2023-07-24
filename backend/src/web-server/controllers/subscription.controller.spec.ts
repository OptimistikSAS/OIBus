import SubscriptionController from './subscription.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

const subscriptionController = new SubscriptionController();

const ctx = new KoaContextMock();
describe('Subscription controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('getNorthSubscriptions() should return subscriptions', async () => {
    const northId = 'northId';

    ctx.params.northId = northId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions.mockReturnValue(['south1', 'south2']);

    await subscriptionController.getNorthSubscriptions(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions).toHaveBeenCalledWith(northId);
    expect(ctx.ok).toHaveBeenCalledWith(['south1', 'south2']);
  });

  it('getExternalNorthSubscriptions() should return external subscriptions', async () => {
    const northId = 'northId';

    ctx.params.northId = northId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions.mockReturnValue(['external1', 'external2']);

    await subscriptionController.getExternalNorthSubscriptions(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions).toHaveBeenCalledWith(northId);
    expect(ctx.ok).toHaveBeenCalledWith(['external1', 'external2']);
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

  it('getExternalNorthSubscriptions() should return not found', async () => {
    const northId = 'northId';

    ctx.params.northId = northId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await subscriptionController.getExternalNorthSubscriptions(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions).not.toHaveBeenCalled();
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

  it('createExternalNorthSubscription() should create subscription', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue({ id: externalSourceId });
    ctx.app.repositoryService.subscriptionRepository.checkExternalNorthSubscription.mockReturnValue(false);

    await subscriptionController.createExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(externalSourceId);
    expect(ctx.app.repositoryService.subscriptionRepository.checkExternalNorthSubscription).toHaveBeenCalledWith(northId, externalSourceId);
    expect(ctx.app.reloadService.onCreateExternalNorthSubscription).toHaveBeenCalledWith(northId, externalSourceId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('createExternalNorthSubscription() return not found when North is not found', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await subscriptionController.createExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.subscriptionRepository.checkExternalNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createExternalNorthSubscription() return not found when external south is not found', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue(null);

    await subscriptionController.createExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(externalSourceId);
    expect(ctx.app.repositoryService.subscriptionRepository.checkNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createExternalNorthSubscription() return bad request when subscription already exists', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue({ id: externalSourceId });
    ctx.app.repositoryService.subscriptionRepository.checkExternalNorthSubscription.mockReturnValue(true);

    await subscriptionController.createExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(externalSourceId);
    expect(ctx.app.repositoryService.subscriptionRepository.checkExternalNorthSubscription).toHaveBeenCalledWith(northId, externalSourceId);
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

  it('deleteExternalNorthSubscription() should delete external subscription', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue({ id: externalSourceId });

    await subscriptionController.deleteExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(externalSourceId);
    expect(ctx.app.reloadService.onDeleteExternalNorthSubscription).toHaveBeenCalledWith(northId, externalSourceId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteExternalNorthSubscription() should return not found when North is not found', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await subscriptionController.deleteExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onDeleteExternalNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('deleteExternalNorthSubscription() should return not found when external source is not found', async () => {
    const northId = 'northId';
    const externalSourceId = 'externalSourceId';

    ctx.params.northId = northId;
    ctx.params.externalSourceId = externalSourceId;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue({ id: northId });
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue(null);

    await subscriptionController.deleteExternalNorthSubscription(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith(northId);
    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(externalSourceId);
    expect(ctx.app.reloadService.onDeleteExternalNorthSubscription).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
