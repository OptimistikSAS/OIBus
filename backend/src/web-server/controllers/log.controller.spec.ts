import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Group, Item, LogSearchParam, Scope } from '../../../shared/model/logs.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution, createMockServices } from '../../tests/utils/test-utils';
import LogServiceMock from '../../tests/__mocks__/service/log-service.mock';
import { createPageFromArray } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import type { LogController as LogControllerShape } from './log.controller';

const nodeRequire = createRequire(import.meta.url);

let mockLogServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let LogController: typeof LogControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockLogServiceModule = { toLogDTO: mock.fn((log: unknown) => log) };
  mockModule(nodeRequire, '../../service/log.service', mockLogServiceModule);
  const mod = reloadModule<{ LogController: typeof LogControllerShape }>(nodeRequire, './log.controller');
  LogController = mod.LogController;
});

describe('LogController', () => {
  let controller: LogControllerShape;
  let logService: LogServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    logService = new LogServiceMock();
    mockRequest = {
      services: createMockServices({ logService })
    } as Partial<CustomExpressRequest>;
    mockLogServiceModule.toLogDTO = mock.fn((log: unknown) => log);
    controller = new LogController();
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should return logs with search parameters', async () => {
    const page = 1;
    const start = testData.constants.dates.DATE_1;
    const end = testData.constants.dates.DATE_2;
    const levels = 'info,debug';
    const scopeTypes = 'south,north';
    const scopeIds = 'scope1,scope2';
    const itemIds = 'item1,item2';
    const messageContent = 'message';

    const searchParams: LogSearchParam = {
      page: 1,
      start,
      end,
      levels: ['info', 'debug'],
      scopeTypes: ['south', 'north'],
      scopeIds: ['scope1', 'scope2'],
      itemIds: ['item1', 'item2'],
      groupIds: [],
      messageContent
    };

    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    logService.search = mock.fn(() => expectedResult);

    const result = await controller.search(
      start,
      end,
      levels,
      scopeIds,
      scopeTypes,
      itemIds,
      undefined,
      messageContent,
      page,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(logService.search.mock.calls.length, 1);
    assert.deepStrictEqual(logService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should return logs with default search parameters', async () => {
    const now = DateTime.now();
    const dayAgo = now.minus({ days: 1 });

    const searchParams: LogSearchParam = {
      page: 0,
      start: dayAgo.toUTC().toISO(),
      end: testData.constants.dates.FAKE_NOW,
      levels: [],
      scopeTypes: [],
      scopeIds: [],
      itemIds: [],
      groupIds: [],
      messageContent: undefined
    };

    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    logService.search = mock.fn(() => expectedResult);

    const result = await controller.search(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(logService.search.mock.calls.length, 1);
    assert.deepStrictEqual(logService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should suggest scopes by name', async () => {
    const scopes: Array<Scope> = [{ scopeId: 'id', scopeName: 'name' }];
    const name = 'name';
    logService.suggestScopes = mock.fn(() => scopes);

    const result = await controller.suggestScopes(name, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.suggestScopes.mock.calls.length, 1);
    assert.deepStrictEqual(logService.suggestScopes.mock.calls[0].arguments[0], name);
    assert.deepStrictEqual(result, scopes);
  });

  it('should suggest scopes by name with default parameter', async () => {
    const scopes: Array<Scope> = [{ scopeId: 'id', scopeName: 'name' }];
    logService.suggestScopes = mock.fn(() => scopes);

    const result = await controller.suggestScopes(undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.suggestScopes.mock.calls.length, 1);
    assert.deepStrictEqual(logService.suggestScopes.mock.calls[0].arguments[0], '');
    assert.deepStrictEqual(result, scopes);
  });

  it('should get scope by its ID', async () => {
    const scope: Scope = { scopeId: 'id', scopeName: 'name' };
    const scopeId = 'id';
    logService.getScopeById = mock.fn(() => scope);

    const result = await controller.getScopeById(scopeId, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.getScopeById.mock.calls.length, 1);
    assert.deepStrictEqual(logService.getScopeById.mock.calls[0].arguments[0], scopeId);
    assert.deepStrictEqual(result, scope);
  });

  it('should suggest items by name', async () => {
    const items: Array<Item> = [{ itemId: 'item-id', itemName: 'Item Name' }];
    const name = 'Item';
    logService.suggestItems = mock.fn(() => items);

    const result = await controller.suggestItems(name, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.suggestItems.mock.calls.length, 1);
    assert.deepStrictEqual(logService.suggestItems.mock.calls[0].arguments[0], name);
    assert.deepStrictEqual(result, items);
  });

  it('should suggest items by name with default parameter', async () => {
    const items: Array<Item> = [{ itemId: 'item-id', itemName: 'Item Name' }];
    logService.suggestItems = mock.fn(() => items);

    const result = await controller.suggestItems(undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.suggestItems.mock.calls.length, 1);
    assert.deepStrictEqual(logService.suggestItems.mock.calls[0].arguments[0], '');
    assert.deepStrictEqual(result, items);
  });

  it('should get item by its ID', async () => {
    const item: Item = { itemId: 'item-id', itemName: 'Item Name' };
    const itemId = 'item-id';
    logService.getItemById = mock.fn(() => item);

    const result = await controller.getItemById(itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.getItemById.mock.calls.length, 1);
    assert.deepStrictEqual(logService.getItemById.mock.calls[0].arguments[0], itemId);
    assert.deepStrictEqual(result, item);
  });

  it('should suggest groups by name', async () => {
    const groups: Array<Group> = [{ groupId: 'group-id', groupName: 'Group Name' }];
    const name = 'Group';
    logService.suggestGroups = mock.fn(() => groups);

    const result = await controller.suggestGroups(name, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.suggestGroups.mock.calls.length, 1);
    assert.deepStrictEqual(logService.suggestGroups.mock.calls[0].arguments[0], name);
    assert.deepStrictEqual(result, groups);
  });

  it('should suggest groups by name with default parameter', async () => {
    const groups: Array<Group> = [{ groupId: 'group-id', groupName: 'Group Name' }];
    logService.suggestGroups = mock.fn(() => groups);

    const result = await controller.suggestGroups(undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.suggestGroups.mock.calls.length, 1);
    assert.deepStrictEqual(logService.suggestGroups.mock.calls[0].arguments[0], '');
    assert.deepStrictEqual(result, groups);
  });

  it('should get group by its ID', async () => {
    const group: Group = { groupId: 'group-id', groupName: 'Group Name' };
    const groupId = 'group-id';
    logService.getGroupById = mock.fn(() => group);

    const result = await controller.getGroupById(groupId, mockRequest as CustomExpressRequest);

    assert.strictEqual(logService.getGroupById.mock.calls.length, 1);
    assert.deepStrictEqual(logService.getGroupById.mock.calls[0].arguments[0], groupId);
    assert.deepStrictEqual(result, group);
  });
});
