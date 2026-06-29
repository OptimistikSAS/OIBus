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
      itemIds: [],
      groupIds: [],
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

  it('should suggest items', () => {
    logRepository.suggestItems.mock.mockImplementationOnce(() => []);

    const result = service.suggestItems('itemName');

    assert.deepStrictEqual(logRepository.suggestItems.mock.calls[0].arguments, ['itemName']);
    assert.deepStrictEqual(result, []);
  });

  it('should get an item', () => {
    logRepository.getItemById.mock.mockImplementationOnce(() => ({ itemId: 'itemId', itemName: 'itemName' }));

    const result = service.getItemById('itemId');

    assert.deepStrictEqual(logRepository.getItemById.mock.calls[0].arguments, ['itemId']);
    assert.deepStrictEqual(result, { itemId: 'itemId', itemName: 'itemName' });
  });

  it('should throw if item not found', () => {
    logRepository.getItemById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.getItemById('itemId'), { message: `Item "itemId" not found` });
    assert.deepStrictEqual(logRepository.getItemById.mock.calls[0].arguments, ['itemId']);
  });

  it('should suggest groups', () => {
    logRepository.suggestGroups.mock.mockImplementationOnce(() => []);

    const result = service.suggestGroups('groupName');

    assert.deepStrictEqual(logRepository.suggestGroups.mock.calls[0].arguments, ['groupName']);
    assert.deepStrictEqual(result, []);
  });

  it('should get a group', () => {
    logRepository.getGroupById.mock.mockImplementationOnce(() => ({ groupId: 'groupId', groupName: 'groupName' }));

    const result = service.getGroupById('groupId');

    assert.deepStrictEqual(logRepository.getGroupById.mock.calls[0].arguments, ['groupId']);
    assert.deepStrictEqual(result, { groupId: 'groupId', groupName: 'groupName' });
  });

  it('should throw if group not found', () => {
    logRepository.getGroupById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.getGroupById('groupId'), { message: `Group "groupId" not found` });
    assert.deepStrictEqual(logRepository.getGroupById.mock.calls[0].arguments, ['groupId']);
  });

  it('should properly convert to DTO', () => {
    const log = testData.logs.list[0];
    assert.deepStrictEqual(toLogDTO(log), {
      timestamp: log.timestamp,
      level: log.level,
      scopeType: log.scopeType,
      scopeId: log.scopeId,
      scopeName: log.scopeName,
      itemId: log.itemId,
      itemName: log.itemName,
      groupId: log.groupId,
      groupName: log.groupName,
      message: log.message
    });
  });
});
