import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import testData from '../tests/utils/test-data';
import { createPageFromArray } from '../../shared/model/types';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import LogService, { toLogDTO } from './log.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { DateTime } from 'luxon';
import { LogSearchParam } from '../../shared/model/logs.model';
import { NotFoundError } from '../model/types';

let validator: { validate: ReturnType<typeof mock.fn> };
let logRepository: LogRepositoryMock;
let service: LogService;

describe('Log Service', () => {
  beforeEach(() => {
    validator = { validate: mock.fn() };
    logRepository = new LogRepositoryMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    service = new LogService(validator as unknown as JoiValidator, logRepository as unknown as LogRepository);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should search logs', () => {
    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    logRepository.search.mock.mockImplementationOnce(() => expectedResult);

    const searchParams: LogSearchParam = {
      page: 0,
      start: DateTime.now().minus({ days: 1 }).toUTC().toISO(),
      end: DateTime.now().toUTC().toISO(),
      levels: [],
      scopeIds: [],
      scopeTypes: [],
      messageContent: undefined
    };
    const result = service.search(searchParams);

    assert.deepStrictEqual(logRepository.search.mock.calls[0].arguments, [searchParams]);
    assert.deepStrictEqual(result, expectedResult);
  });

  it('should suggest scopes', () => {
    logRepository.suggestScopes.mock.mockImplementationOnce(() => []);

    const result = service.suggestScopes('scopeName');

    assert.deepStrictEqual(logRepository.suggestScopes.mock.calls[0].arguments, ['scopeName']);
    assert.deepStrictEqual(result, []);
  });

  it('should get a scope', () => {
    logRepository.getScopeById.mock.mockImplementationOnce(() => ({ scopeId: 'scopeId', scopeName: 'scopeName' }));

    const result = service.getScopeById('scopeId');

    assert.deepStrictEqual(logRepository.getScopeById.mock.calls[0].arguments, ['scopeId']);
    assert.deepStrictEqual(result, { scopeId: 'scopeId', scopeName: 'scopeName' });
  });

  it('should not get if the scope is not found', () => {
    logRepository.getScopeById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.getScopeById('scopeId'), { message: `Scope "scopeId" not found` });
    assert.deepStrictEqual(logRepository.getScopeById.mock.calls[0].arguments, ['scopeId']);
  });

  it('should properly convert to DTO', () => {
    const log = testData.logs.list[0];
    assert.deepStrictEqual(toLogDTO(log), {
      timestamp: log.timestamp,
      level: log.level,
      scopeType: log.scopeType,
      scopeId: log.scopeId,
      scopeName: log.scopeName,
      message: log.message
    });
  });
});
