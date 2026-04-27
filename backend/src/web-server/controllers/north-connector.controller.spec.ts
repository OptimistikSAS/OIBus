import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { NorthConnectorCommandDTO, OIBusNorthType } from '../../../shared/model/north-connector.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import NorthServiceMock from '../../tests/__mocks__/service/north-service.mock';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import { StandardTransformerDTO, TransformerDTOWithOptions } from '../../../shared/model/transformer.model';
import { CacheContentUpdateCommand, CacheMetadata } from '../../../shared/model/engine.model';
import { OIBusTestingError } from '../../model/types';
import type { NorthConnectorController as NorthConnectorControllerShape } from './north-connector.controller';

const nodeRequire = createRequire(import.meta.url);

let mockNorthServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let NorthConnectorController: typeof NorthConnectorControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockNorthServiceModule = {
    toNorthConnectorDTO: mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    }),
    toNorthConnectorLightDTO: mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    })
  };
  mockModule(nodeRequire, '../../service/north.service', mockNorthServiceModule);
  const mod = reloadModule<{ NorthConnectorController: typeof NorthConnectorControllerShape }>(nodeRequire, './north-connector.controller');
  NorthConnectorController = mod.NorthConnectorController;
});

describe('NorthConnectorController', () => {
  let controller: NorthConnectorControllerShape;
  let northService: NorthServiceMock;
  let oIBusService: OIBusServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    northService = new NorthServiceMock();
    oIBusService = new OIBusServiceMock();
    userService = new UserServiceMock();
    mockRequest = {
      services: { northService, oIBusService, userService },
      user: { id: 'test', login: 'testUser' }
    } as Partial<CustomExpressRequest>;
    mockNorthServiceModule.toNorthConnectorDTO = mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    });
    mockNorthServiceModule.toNorthConnectorLightDTO = mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    });
    controller = new NorthConnectorController();
  });

  it('should return north connector types', async () => {
    const mockManifests = [testData.north.manifest];
    northService.listManifest = mock.fn(() => mockManifests);

    const result = controller.listManifest(mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.listManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, [
      {
        id: testData.north.manifest.id,
        category: testData.north.manifest.category,
        types: testData.north.manifest.types
      }
    ]);
  });

  it('should return a north connector manifest', async () => {
    const mockManifest = testData.north.manifest;
    const type = testData.north.manifest.id;
    northService.getManifest = mock.fn(() => mockManifest);

    const result = controller.getManifest(type, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.getManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockManifest);
  });

  it('should return a list of north connectors', async () => {
    const mockNorthConnectors = testData.north.list;
    northService.list = mock.fn(() => mockNorthConnectors);

    const result = controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockNorthConnectors);
  });

  it('should return a north connector by ID', async () => {
    const mockNorthConnector = testData.north.list[0];
    const northId = mockNorthConnector.id;
    northService.findById = mock.fn(() => mockNorthConnector);

    const result = await controller.findById(northId, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(northService.findById.mock.calls[0].arguments[0], northId);
    assert.deepStrictEqual(result, mockNorthConnector);
  });

  it('should create a new north connector', async () => {
    const command: NorthConnectorCommandDTO = testData.north.command;
    const createdNorthConnector = testData.north.list[0];
    northService.create = mock.fn(async () => createdNorthConnector);

    const result = await controller.create(command, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.create.mock.calls.length, 1);
    assert.deepStrictEqual(northService.create.mock.calls[0].arguments, [command, null, 'test']);
    assert.deepStrictEqual(result, createdNorthConnector);
  });

  it('should update an existing north connector', async () => {
    const northId = testData.north.list[0].id;
    const command: NorthConnectorCommandDTO = testData.north.command;
    northService.update = mock.fn(async () => undefined);

    await controller.update(northId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.update.mock.calls.length, 1);
    assert.deepStrictEqual(northService.update.mock.calls[0].arguments, [northId, command, 'test']);
  });

  it('should delete a north connector', async () => {
    const northId = testData.north.list[0].id;
    northService.delete = mock.fn(async () => undefined);

    await controller.delete(northId, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(northService.delete.mock.calls[0].arguments[0], northId);
  });

  it('should start a north connector', async () => {
    const northId = testData.north.list[0].id;
    northService.start = mock.fn(async () => undefined);

    await controller.start(northId, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.start.mock.calls.length, 1);
    assert.deepStrictEqual(northService.start.mock.calls[0].arguments[0], northId);
  });

  it('should stop a north connector', async () => {
    const northId = testData.north.list[0].id;
    northService.stop = mock.fn(async () => undefined);

    await controller.stop(northId, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.stop.mock.calls.length, 1);
    assert.deepStrictEqual(northService.stop.mock.calls[0].arguments[0], northId);
  });

  it('should reset north connector metrics', async () => {
    const northId = testData.north.list[0].id;
    oIBusService.resetNorthMetrics = mock.fn(async () => undefined);

    await controller.resetMetrics(northId, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.resetNorthMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.resetNorthMetrics.mock.calls[0].arguments[0], northId);
  });

  it('should test north connection', async () => {
    const northId = testData.north.list[0].id;
    const northType: OIBusNorthType = testData.north.command.type;
    const settings = testData.north.command.settings;
    northService.testNorth = mock.fn(async () => ({ items: [] }));

    await controller.testNorth(northId, northType, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.testNorth.mock.calls.length, 1);
    assert.deepStrictEqual(northService.testNorth.mock.calls[0].arguments, [northId, northType, settings]);
  });

  it('should wrap errors when testing north connection', async () => {
    const northId = testData.north.list[0].id;
    const northType: OIBusNorthType = testData.north.command.type;
    const settings = testData.north.command.settings;
    northService.testNorth = mock.fn(async () => {
      throw new Error('North connection failure');
    });

    try {
      await controller.testNorth(northId, northType, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual(error.message, 'North connection failure');
    }
    assert.strictEqual(northService.testNorth.mock.calls.length, 1);
    assert.deepStrictEqual(northService.testNorth.mock.calls[0].arguments, [northId, northType, settings]);
  });

  it('should add or edit a transformer', async () => {
    const northId = testData.north.list[0].id;
    const transformer: TransformerDTOWithOptions = {
      id: 'northTransformerId1',
      transformer: testData.transformers.list[0] as StandardTransformerDTO,
      options: {},
      source: { type: 'oianalytics-setpoint' }
    };
    northService.addOrEditTransformer = mock.fn(async () => undefined);

    await controller.addOrEditTransformer(northId, transformer, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.addOrEditTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(northService.addOrEditTransformer.mock.calls[0].arguments, [northId, transformer]);
  });

  it('should remove a transformer', async () => {
    const northId = testData.north.list[0].id;
    const transformerId = testData.transformers.list[0].id;
    northService.removeTransformer = mock.fn(async () => undefined);

    await controller.removeTransformer(northId, transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(northService.removeTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(northService.removeTransformer.mock.calls[0].arguments, [northId, transformerId]);
  });

  it('should search cache content with default params', async () => {
    const northId = testData.north.list[0].id;
    const mockCacheMetadata: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    oIBusService.searchCacheContent = mock.fn(async () => mockCacheMetadata);

    const result = await controller.searchCacheContent(
      northId,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'north',
      northId,
      { start: undefined, end: undefined, nameContains: undefined, maxNumberOfFilesReturned: 0 }
    ]);
    assert.deepStrictEqual(result, mockCacheMetadata);
  });

  it('should search cache content with parameters', async () => {
    const northId = testData.north.list[0].id;
    const nameContains = 'test';
    const start = testData.constants.dates.DATE_1;
    const end = testData.constants.dates.DATE_2;
    const mockCacheMetadata: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    oIBusService.searchCacheContent = mock.fn(async () => mockCacheMetadata);

    const result = await controller.searchCacheContent(northId, nameContains, start, end, 10000, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'north',
      northId,
      { start, end, nameContains, maxNumberOfFilesReturned: 10000 }
    ]);
    assert.deepStrictEqual(result, mockCacheMetadata);
  });

  it('should get cache file content', async () => {
    const northId = testData.north.list[0].id;
    const folder = 'cache';
    const filename = 'test-file';
    const mockFileStream = { pipe: mock.fn() };
    oIBusService.getFileFromCache = mock.fn(async () => mockFileStream);

    await controller.getCacheFileContent(northId, filename, folder, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.getFileFromCache.mock.calls[0].arguments, ['north', northId, folder, filename]);
  });

  it('should update cache content', async () => {
    const northId = testData.north.list[0].id;
    oIBusService.updateCacheContent = mock.fn(async () => undefined);

    await controller.updateCacheContent(northId, {} as CacheContentUpdateCommand, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateCacheContent.mock.calls[0].arguments, ['north', northId, {}]);
  });
});
