import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import IPFilterServiceMock from '../../tests/__mocks__/service/ip-filter-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import type { IPFilterController as IPFilterControllerShape } from './ip-filter.controller';

const nodeRequire = createRequire(import.meta.url);

let mockIPFilterServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let IPFilterController: typeof IPFilterControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockIPFilterServiceModule = {
    toIPFilterDTO: mock.fn((ipFilter: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return ipFilter;
    })
  };
  mockModule(nodeRequire, '../../service/ip-filter.service', mockIPFilterServiceModule);
  const mod = reloadModule<{ IPFilterController: typeof IPFilterControllerShape }>(nodeRequire, './ip-filter.controller');
  IPFilterController = mod.IPFilterController;
});

describe('IPFilterController', () => {
  let controller: IPFilterControllerShape;
  let ipFilterService: IPFilterServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    ipFilterService = new IPFilterServiceMock();
    userService = new UserServiceMock();
    mockRequest = {
      services: Object.assign({} as CustomExpressRequest['services'], { ipFilterService, userService }),
      user: { id: 'test', login: 'testUser' }
    } as Partial<CustomExpressRequest>;
    mockIPFilterServiceModule.toIPFilterDTO = mock.fn((ipFilter: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return ipFilter;
    });
    controller = new IPFilterController();
  });

  it('should return a list of IP filters', async () => {
    const mockIPFilters = testData.ipFilters.list;
    ipFilterService.list = mock.fn(() => mockIPFilters);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(ipFilterService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockIPFilters);
  });

  it('should return an IP filter by ID', async () => {
    const mockIPFilter = testData.ipFilters.list[0];
    const ipFilterId = mockIPFilter.id;
    ipFilterService.findById = mock.fn(() => mockIPFilter);

    const result = await controller.findById(ipFilterId, mockRequest as CustomExpressRequest);

    assert.strictEqual(ipFilterService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(ipFilterService.findById.mock.calls[0].arguments[0], ipFilterId);
    assert.deepStrictEqual(result, mockIPFilter);
  });

  it('should create a new IP filter', async () => {
    const command: IPFilterCommandDTO = testData.ipFilters.command;
    const createdIPFilter = testData.ipFilters.list[0];
    ipFilterService.create = mock.fn(async () => createdIPFilter);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(ipFilterService.create.mock.calls.length, 1);
    assert.deepStrictEqual(ipFilterService.create.mock.calls[0].arguments, [command, 'test']);
    assert.deepStrictEqual(result, createdIPFilter);
  });

  it('should update an existing IP filter', async () => {
    const ipFilterId = testData.ipFilters.list[0].id;
    const command: IPFilterCommandDTO = testData.ipFilters.command;
    ipFilterService.update = mock.fn(async () => undefined);

    await controller.update(ipFilterId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(ipFilterService.update.mock.calls.length, 1);
    assert.deepStrictEqual(ipFilterService.update.mock.calls[0].arguments, [ipFilterId, command, 'test']);
  });

  it('should delete an IP filter', async () => {
    const ipFilterId = testData.ipFilters.list[0].id;
    ipFilterService.delete = mock.fn(async () => undefined);

    await controller.delete(ipFilterId, mockRequest as CustomExpressRequest);

    assert.strictEqual(ipFilterService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(ipFilterService.delete.mock.calls[0].arguments[0], ipFilterId);
  });
});
