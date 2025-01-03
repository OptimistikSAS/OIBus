import SubscriptionController from './subscription.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import testData from '../../tests/utils/test-data';
import { toSouthConnectorLightDTO } from '../../service/south.service';

const subscriptionController = new SubscriptionController();

const ctx = new KoaContextMock();
const northId = 'northId';
const southId = 'southId';

describe('Subscription Controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('findByNorth() should return subscriptions', async () => {
    ctx.params.northId = northId;
    ctx.app.northService.findSubscriptionsByNorth.mockReturnValueOnce(
      testData.south.list.map(element => toSouthConnectorLightDTO(element))
    );

    await subscriptionController.findByNorth(ctx);

    expect(ctx.app.northService.findSubscriptionsByNorth).toHaveBeenCalledWith(northId);
    expect(ctx.ok).toHaveBeenCalledWith(testData.south.list.map(element => toSouthConnectorLightDTO(element)));
  });

  it('findByNorth() should return bad request', async () => {
    ctx.params.northId = northId;
    ctx.app.northService.findSubscriptionsByNorth.mockImplementationOnce(() => {
      throw new Error('Not Found');
    });

    await subscriptionController.findByNorth(ctx);

    expect(ctx.app.northService.findSubscriptionsByNorth).toHaveBeenCalledWith(northId);
    expect(ctx.badRequest).toHaveBeenCalledWith('Not Found');
  });

  it('create() should create subscription', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;

    await subscriptionController.create(ctx);

    expect(ctx.app.northService.createSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('create() should return bad request', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.northService.createSubscription.mockImplementationOnce(() => {
      throw new Error('Not Found');
    });

    await subscriptionController.create(ctx);

    expect(ctx.app.northService.createSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.badRequest).toHaveBeenCalledWith('Not Found');
  });

  it('delete() should delete subscription', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;

    await subscriptionController.delete(ctx);

    expect(ctx.app.northService.deleteSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should return bad request', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.northService.deleteSubscription.mockImplementationOnce(() => {
      throw new Error('Not Found');
    });

    await subscriptionController.delete(ctx);

    expect(ctx.app.northService.deleteSubscription).toHaveBeenCalledWith(northId, southId);
    expect(ctx.badRequest).toHaveBeenCalledWith('Not Found');
  });
});
