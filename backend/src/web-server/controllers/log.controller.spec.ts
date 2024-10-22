import Joi from 'joi';

import LogController from './log.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { LogSearchParam, Scope } from '../../../../shared/model/logs.model';
import testData from '../../tests/utils/test-data';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const logController = new LogController(validator, schema);

const ctx = new KoaContextMock();
const logStreamValuesCommand = {
  values: [[`${1000000 * Date.now()}`, 'message']],
  stream: {
    level: 'info',
    oibus: 'oibus',
    scopeType: 'scopeType'
  }
};
const logStreamCommand = {
  streams: [logStreamValuesCommand, null]
};
const formattedLog = {
  oibus: logStreamValuesCommand.stream.oibus,
  time: new Date(parseInt(logStreamValuesCommand.values[0][0]) / 1000000),
  scopeType: logStreamValuesCommand.stream.scopeType,
  msg: logStreamValuesCommand.values[0][1]
};
const log = {
  timestamp: formattedLog.time.toISOString(),
  level: logStreamValuesCommand.stream.level,
  scopeType: formattedLog.scopeType,
  message: formattedLog.msg
};
const page = {
  content: [log],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};

describe('Log controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('searchLogs() should return logs', async () => {
    ctx.query.levels = ['info'];
    ctx.query.page = 1;
    ctx.query.start = '2023-03-01T00:00:00.000Z';
    ctx.query.end = '2023-03-31T00:00:00.000Z';
    ctx.query.scopeTypes = ['scopeType'];
    ctx.query.scopeIds = ['scope'];
    ctx.query.messageContent = 'message';
    const searchParams: LogSearchParam = {
      page: 1,
      start: '2023-03-01T00:00:00.000Z',
      end: '2023-03-31T00:00:00.000Z',
      levels: ['info'],
      scopeTypes: ['scopeType'],
      scopeIds: ['scope'],
      messageContent: 'message'
    };
    ctx.app.repositoryService.logRepository.search.mockReturnValue(page);

    await logController.search(ctx);

    expect(ctx.app.repositoryService.logRepository.search).toHaveBeenCalledWith(searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('search() should return logs with default search params', async () => {
    ctx.query = {
      levels: 'info',
      scopeTypes: 'scopeType1',
      scopeIds: 'scope1'
    };
    const searchParams: LogSearchParam = {
      page: 0,
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date().toISOString(),
      levels: ['info'],
      scopeTypes: ['scopeType1'],
      scopeIds: ['scope1'],
      messageContent: null
    };
    ctx.app.repositoryService.logRepository.search.mockReturnValue(page);

    await logController.search(ctx);

    expect(ctx.app.repositoryService.logRepository.search).toHaveBeenCalledWith(searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  const levels: Array<string> = ['trace', 'debug', 'info', 'warn', 'error'];
  it.each(levels)(`addLogs() should %p log`, async level => {
    ctx.request.body = logStreamCommand;
    ctx.request.body.streams[0].stream.level = level;

    await logController.addLogs(ctx);

    expect(ctx.app.logger[level]).toHaveBeenCalledWith(formattedLog);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('addLogs() should return bad request', async () => {
    ctx.request.body = undefined;
    ctx.app.repositoryService.logRepository.search.mockReturnValue(page);

    await logController.addLogs(ctx);

    expect(ctx.app.logger.trace).not.toHaveBeenCalled();
    expect(ctx.app.logger.debug).not.toHaveBeenCalled();
    expect(ctx.app.logger.info).not.toHaveBeenCalled();
    expect(ctx.app.logger.warn).not.toHaveBeenCalled();
    expect(ctx.app.logger.error).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('should suggest scopes by name', async () => {
    const scopes: Array<Scope> = [{ scopeId: 'id', scopeName: 'name' }];
    ctx.app.repositoryService.logRepository.searchScopesByName.mockReturnValue(scopes);
    ctx.query = { name: 'name' };
    await logController.suggestScopes(ctx);
    expect(ctx.ok).toHaveBeenCalledWith(scopes);
    expect(ctx.app.repositoryService.logRepository.searchScopesByName).toHaveBeenCalledWith('name');
  });

  it('should get scope by its ID', async () => {
    const scope: Scope = { scopeId: 'id', scopeName: 'name' };
    ctx.app.repositoryService.logRepository.getScopeById.mockReturnValue(scope);
    ctx.params = { id: 'id' };
    await logController.getScopeById(ctx);
    expect(ctx.ok).toHaveBeenCalledWith(scope);
    expect(ctx.app.repositoryService.logRepository.getScopeById).toHaveBeenCalledWith('id');
  });

  it('should get scope by its ID', async () => {
    ctx.app.repositoryService.logRepository.getScopeById.mockReturnValue(null);
    ctx.params = { id: 'id' };
    await logController.getScopeById(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
