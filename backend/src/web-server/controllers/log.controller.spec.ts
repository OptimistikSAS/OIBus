import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LogSearchParam, Scope } from '../../../shared/model/logs.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
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
      services: { logService }
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
    const messageContent = 'message';

    const searchParams: LogSearchParam = {
      page: 1,
      start,
      end,
      levels: ['info', 'debug'],
      scopeTypes: ['south', 'north'],
      scopeIds: ['scope1', 'scope2'],
      messageContent
    };

    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    logService.search = mock.fn(async () => expectedResult);

    const result = await controller.search(
      start,
      end,
      levels,
      scopeIds,
      scopeTypes,
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
      messageContent: undefined
    };

    const expectedResult = createPageFromArray(testData.logs.list, 25, 0);
    logService.search = mock.fn(async () => expectedResult);

    const result = await controller.search(
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
});
