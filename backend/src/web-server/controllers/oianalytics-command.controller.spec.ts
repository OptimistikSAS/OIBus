import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { CommandSearchParam } from '../../../../shared/model/command.model';
import OianalyticsCommandController from './oianalytics-command.controller';
import { createPageFromArray } from '../../../../shared/model/types';
import testData from '../../tests/utils/test-data';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const commandController = new OianalyticsCommandController(validator, schema);

const ctx = new KoaContextMock();

describe('OIAnalytics Command controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('search() should return commands', async () => {
    ctx.query.status = ['ERRORED'];
    ctx.query.types = ['UPGRADE'];
    ctx.query.page = 1;
    const searchParams: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    ctx.app.oIAnalyticsCommandService.search.mockReturnValue(createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 1));

    await commandController.search(ctx);

    expect(ctx.app.oIAnalyticsCommandService.search).toHaveBeenCalledWith(searchParams, 1);
    expect(ctx.ok).toHaveBeenCalledWith(createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 1));
  });

  it('search() should return commands with default search params', async () => {
    ctx.query = {
      types: 'UPGRADE',
      status: 'ERRORED'
    };
    const searchParams: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };

    const page = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 0);
    ctx.app.oIAnalyticsCommandService.search.mockReturnValueOnce(page);

    await commandController.search(ctx);

    expect(ctx.app.oIAnalyticsCommandService.search).toHaveBeenCalledWith(searchParams, 0);
    expect(ctx.ok).toHaveBeenCalledWith(createPageFromArray(testData.oIAnalytics.commands.oIBusList, 25, 0));
  });
});
