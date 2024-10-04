import SubscriptionController from './subscription.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import testData from '../../tests/utils/test-data';

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
    ctx.app.subscriptionService.findByNorth.mockReturnValueOnce(testData.subscriptions.list);

    await subscriptionController.findByNorth(ctx);

    expect(ctx.app.subscriptionService.findByNorth).toHaveBeenCalledWith(northId);
    expect(ctx.ok).toHaveBeenCalledWith(testData.subscriptions.dto);
  });

  it('findByNorth() should return bad request', async () => {
    ctx.params.northId = northId;
    ctx.app.subscriptionService.findByNorth.mockImplementationOnce(() => {
      throw new Error('Not Found');
    });

    await subscriptionController.findByNorth(ctx);

    expect(ctx.app.subscriptionService.findByNorth).toHaveBeenCalledWith(northId);
    expect(ctx.badRequest).toHaveBeenCalledWith('Not Found');
  });

  it('create() should create subscription', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;

    await subscriptionController.create(ctx);

    expect(ctx.app.subscriptionService.create).toHaveBeenCalledWith(northId, southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('create() should return bad request', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.subscriptionService.create.mockImplementationOnce(() => {
      throw new Error('Not Found');
    });

    await subscriptionController.create(ctx);

    expect(ctx.app.subscriptionService.create).toHaveBeenCalledWith(northId, southId);
    expect(ctx.badRequest).toHaveBeenCalledWith('Not Found');
  });

  it('delete() should delete subscription', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;

    await subscriptionController.delete(ctx);

    expect(ctx.app.subscriptionService.delete).toHaveBeenCalledWith(northId, southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should return bad request', async () => {
    ctx.params.northId = northId;
    ctx.params.southId = southId;
    ctx.app.subscriptionService.delete.mockImplementationOnce(() => {
      throw new Error('Not Found');
    });

    await subscriptionController.delete(ctx);

    expect(ctx.app.subscriptionService.delete).toHaveBeenCalledWith(northId, southId);
    expect(ctx.badRequest).toHaveBeenCalledWith('Not Found');
  });
});
