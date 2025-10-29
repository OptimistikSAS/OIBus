import Joi from 'joi';

import LogController from './log.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { LogSearchParam, Scope } from '../../../shared/model/logs.model';
import testData from '../../tests/utils/test-data';
import { createPageFromArray } from '../../../shared/model/types';
import { toLogDTO } from '../../service/log.service';
import { DateTime } from 'luxon';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const logController = new LogController(validator, schema);

const ctx = new KoaContextMock();

describe('Log controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('searchLogs() should return logs', async () => {
    ctx.query.levels = ['info'];
    ctx.query.page = 1;
    ctx.query.start = testData.constants.dates.DATE_1;
    ctx.query.end = testData.constants.dates.DATE_2;
    ctx.query.scopeTypes = ['scopeType'];
    ctx.query.scopeIds = ['scope'];
    ctx.query.messageContent = 'message';
    const searchParams: LogSearchParam = {
      page: 1,
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      levels: ['info'],
      scopeTypes: ['scopeType'],
      scopeIds: ['scope'],
      messageContent: 'message'
    };
    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    ctx.app.logService.search.mockReturnValue(expectedResult);

    await logController.search(ctx);

    expect(ctx.app.logService.search).toHaveBeenCalledWith(searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      ...expectedResult,
      content: expectedResult.content.map(element => toLogDTO(element))
    });
  });

  it('search() should return logs with default search params', async () => {
    ctx.query = {
      levels: 'info',
      scopeTypes: 'scopeType1',
      scopeIds: 'scope1'
    };
    const searchParams: LogSearchParam = {
      page: 0,
      start: DateTime.now().minus({ days: 1 }).toUTC().toISO(),
      end: testData.constants.dates.FAKE_NOW,
      levels: ['info'],
      scopeTypes: ['scopeType1'],
      scopeIds: ['scope1'],
      messageContent: null
    };
    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    ctx.app.logService.search.mockReturnValue(expectedResult);

    await logController.search(ctx);

    expect(ctx.app.logService.search).toHaveBeenCalledWith(searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({ ...expectedResult, content: expectedResult.content.map(element => toLogDTO(element)) });
  });

  it('should suggest scopes by name', async () => {
    const scopes: Array<Scope> = [{ scopeId: 'id', scopeName: 'name' }];
    ctx.app.logService.searchScopesByName.mockReturnValue(scopes);
    ctx.query = { name: 'name' };
    await logController.suggestScopes(ctx);
    expect(ctx.ok).toHaveBeenCalledWith(scopes);
    expect(ctx.app.logService.searchScopesByName).toHaveBeenCalledWith('name');
  });

  it('should get scope by its ID', async () => {
    const scope: Scope = { scopeId: 'id', scopeName: 'name' };
    ctx.app.logService.getScopeById.mockReturnValueOnce(scope);
    ctx.params = { id: 'id' };
    await logController.getScopeById(ctx);
    expect(ctx.ok).toHaveBeenCalledWith(scope);
    expect(ctx.app.logService.getScopeById).toHaveBeenCalledWith('id');
  });

  it('should get scope by its ID and return null if not found', async () => {
    ctx.app.logService.getScopeById.mockReturnValueOnce(null);
    ctx.params = { id: 'id' };
    await logController.getScopeById(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
