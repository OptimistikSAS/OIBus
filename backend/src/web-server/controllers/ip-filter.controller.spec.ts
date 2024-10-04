import Joi from 'joi';

import IpFilterController from './ip-filter.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import testData from '../../tests/utils/test-data';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const ipFilterController = new IpFilterController(validator, schema);

const ctx = new KoaContextMock();

describe('IP filter controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('findAll() should return ip filters', async () => {
    ctx.app.ipFilterService.findAll.mockReturnValueOnce(testData.ipFilters.dto);

    await ipFilterController.findAll(ctx);

    expect(ctx.app.ipFilterService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.ipFilters.dto);
  });

  it('findById() should return ip filter', async () => {
    ctx.params.id = testData.ipFilters.list[0].id;
    ctx.app.ipFilterService.findById.mockReturnValueOnce(testData.ipFilters.list[0]);

    await ipFilterController.findById(ctx);

    expect(ctx.app.ipFilterService.findById).toHaveBeenCalledWith(testData.ipFilters.dto[0].id);
    expect(ctx.ok).toHaveBeenCalledWith(testData.ipFilters.dto[0]);
  });

  it('findById() should return not found', async () => {
    ctx.params.id = testData.ipFilters.list[0].id;
    ctx.app.ipFilterService.findById.mockReturnValueOnce(null);

    await ipFilterController.findById(ctx);

    expect(ctx.app.ipFilterService.findById).toHaveBeenCalledWith(testData.ipFilters.list[0].id);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should create ip filter', async () => {
    ctx.request.body = testData.ipFilters.command;
    ctx.app.ipFilterService.create.mockReturnValueOnce(testData.ipFilters.dto[0]);

    await ipFilterController.create(ctx);

    expect(ctx.app.ipFilterService.create).toHaveBeenCalledWith(testData.ipFilters.command, ctx.app.ipFilters);
    expect(ctx.created).toHaveBeenCalledWith(testData.ipFilters.dto[0]);
  });

  it('create() should return bad request', async () => {
    ctx.request.body = testData.ipFilters.command;
    ctx.app.ipFilterService.create.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await ipFilterController.create(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('update() should update ip filter', async () => {
    ctx.params.id = testData.ipFilters.list[0].id;
    ctx.request.body = testData.ipFilters.command;

    await ipFilterController.update(ctx);

    expect(ctx.app.ipFilterService.update).toHaveBeenCalledWith(
      testData.ipFilters.list[0].id,
      testData.ipFilters.command,
      ctx.app.ipFilters
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should return bad request', async () => {
    ctx.params.id = testData.ipFilters.list[0].id;
    ctx.request.body = testData.ipFilters.command;
    ctx.app.ipFilterService.update.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await ipFilterController.update(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('delete() should delete ip filter', async () => {
    ctx.params.id = testData.ipFilters.list[0].id;

    await ipFilterController.delete(ctx);

    expect(ctx.app.ipFilterService.delete).toHaveBeenCalledWith(testData.ipFilters.list[0].id, ctx.app.ipFilters);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should return not found', async () => {
    ctx.params.id = testData.ipFilters.list[0].id;
    ctx.app.ipFilterService.delete.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await ipFilterController.delete(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });
});
