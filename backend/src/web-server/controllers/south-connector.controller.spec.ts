import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type express from 'express';

import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthExploreBrowseResult,
  SouthExploreStartResult,
  SouthItemGroupCommandDTO
} from '../../../shared/model/api/south-connector.model';
import { OIBusContent } from '../../../shared/model/common/content.model';
import { SouthConnectorItemSearchParam } from '../../../shared/model/domain/south-connector.model';

import type { SouthItemGroupEntity } from '../../model/south-connector.model';
import { OIBusTestingError } from '../../model/types';
import type ConfigurationWorkflowRunService from '../../service/configuration-workflow-run.service';
import type OIBusService from '../../service/oibus.service';
import type ScanModeService from '../../service/scan-mode.service';
import type SouthService from '../../service/south.service';
import type UserService from '../../service/user.service';
import testData from '../../tests/utils/test-data';
import { createMock, createMockServices, fixTsoaModuleResolution, Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import { CustomExpressRequest } from '../express';
import type { SouthConnectorController as SouthConnectorControllerShape } from './south-connector.controller';

const nodeRequire = createRequire(import.meta.url);

// The DTO mappers return the entity as is, after asking for the user info like the real ones
const createSouthServiceModuleMocks = () => ({
  toSouthConnectorDTO: mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return connector;
  }),
  toSouthConnectorLightDTO: mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return connector;
  }),
  toSouthConnectorItemDTO: mock.fn((item: unknown, _southType: unknown, getUserInfo?: (id: string) => void) => {
    if (getUserInfo) getUserInfo('');
    return item;
  }),
  toSouthItemGroupDTO: mock.fn((group: unknown, getUserInfo?: (id: string) => void) => {
    if (getUserInfo) getUserInfo('');
    return group;
  })
});
// Same objects for the whole file (the controller keeps them): their functions are replaced in beforeEach
const southServiceModule = createSouthServiceModuleMocks();
const utilsModule = { itemToFlattenedCSV: mock.fn(() => 'csv content') };
let SouthConnectorController: typeof SouthConnectorControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockModule(nodeRequire, '../../service/south.service', southServiceModule);
  mockModule(nodeRequire, '../../service/utils', utilsModule);
  const mod = reloadModule<{ SouthConnectorController: typeof SouthConnectorControllerShape }>(nodeRequire, './south-connector.controller');
  SouthConnectorController = mod.SouthConnectorController;
});

describe('SouthConnectorController', () => {
  let controller: SouthConnectorControllerShape;
  let southService: Mocked<SouthService>;
  let scanModeService: Mocked<ScanModeService>;
  let oIBusService: Mocked<OIBusService>;
  let userService: Mocked<UserService>;
  let mockRequest: Partial<CustomExpressRequest>;
  let configurationWorkflowRunService: Mocked<ConfigurationWorkflowRunService>;
  let mockRes: Mocked<express.Response>;

  beforeEach(() => {
    southService = createMock<SouthService>();
    scanModeService = createMock<ScanModeService>();
    oIBusService = createMock<OIBusService>();
    userService = createMock<UserService>();
    configurationWorkflowRunService = createMock<ConfigurationWorkflowRunService>();
    mockRes = createMock<express.Response>();
    mockRes.status.mock.mockImplementation(() => mockRes);
    mockRequest = {
      services: createMockServices({ southService, scanModeService, oIBusService, userService, configurationWorkflowRunService }),
      user: { id: 'test', login: 'testUser' },
      res: mockRes
    };
    Object.assign(southServiceModule, createSouthServiceModuleMocks());
    utilsModule.itemToFlattenedCSV = mock.fn(() => 'csv content');
    controller = new SouthConnectorController();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return south connector types', async () => {
    const mockManifests = [testData.south.manifest];
    southService.listManifest.mock.mockImplementation(() => mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.listManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, [
      {
        id: testData.south.manifest.id,
        category: testData.south.manifest.category,
        beta: testData.south.manifest.beta,
        modes: testData.south.manifest.modes
      }
    ]);
  });

  it('should return south connector types with beta flag carried through', async () => {
    const mockManifests = [{ ...testData.south.manifest, beta: true }];
    southService.listManifest.mock.mockImplementation(() => mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(result, [
      {
        id: testData.south.manifest.id,
        category: testData.south.manifest.category,
        beta: true,
        modes: testData.south.manifest.modes
      }
    ]);
  });

  it('should return a south connector manifest', async () => {
    const mockManifest = testData.south.manifest;
    const type = testData.south.manifest.id;
    southService.getManifest.mock.mockImplementation(() => mockManifest);

    const result = await controller.getManifest(type, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockManifest);
  });

  it('should return a list of south connectors', async () => {
    const mockSouthConnectors = testData.south.list;
    southService.list.mock.mockImplementation(() => mockSouthConnectors);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockSouthConnectors);
  });

  it('should return a south connector by ID', async () => {
    const mockSouthConnector = testData.south.list[0];
    const southId = mockSouthConnector.id;
    southService.findById.mock.mockImplementation(() => mockSouthConnector);

    const result = await controller.findById(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(result, mockSouthConnector);
  });

  it('should create a new south connector', async () => {
    const command: SouthConnectorCommandDTO = testData.south.command;
    const createdSouthConnector = testData.south.list[0];
    southService.create.mock.mockImplementation(async () => createdSouthConnector);

    const result = await controller.create(command, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.create.mock.calls.length, 1);
    assert.deepStrictEqual(southService.create.mock.calls[0].arguments, [command, null, 'test']);
    assert.deepStrictEqual(result, createdSouthConnector);
  });

  it('should update an existing south connector', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthConnectorCommandDTO = testData.south.command;
    southService.update.mock.mockImplementation(async () => undefined);

    await controller.update(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.update.mock.calls.length, 1);
    assert.deepStrictEqual(southService.update.mock.calls[0].arguments, [southId, command, 'test']);
  });

  it('should delete a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.delete.mock.mockImplementation(async () => undefined);

    await controller.delete(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(southService.delete.mock.calls[0].arguments, [southId, 'test']);
  });

  it('should start a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.start.mock.mockImplementation(async () => undefined);

    await controller.start(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.start.mock.calls.length, 1);
    assert.deepStrictEqual(southService.start.mock.calls[0].arguments[0], southId);
  });

  it('should stop a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.stop.mock.mockImplementation(async () => undefined);

    await controller.stop(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.stop.mock.calls.length, 1);
    assert.deepStrictEqual(southService.stop.mock.calls[0].arguments[0], southId);
  });

  it('should get south connector metrics', async () => {
    const southId = testData.south.list[0].id;
    southService.getSouthMetric.mock.mockImplementation(() => testData.south.metrics);

    const result = controller.getMetrics(southId, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(southService.getSouthMetric.mock.calls[0].arguments, [southId]);
    assert.deepStrictEqual(result, testData.south.metrics);
  });

  it('should reset south connector metrics', async () => {
    const southId = testData.south.list[0].id;
    oIBusService.resetSouthMetrics.mock.mockImplementation(async () => undefined);

    await controller.resetSouthMetrics(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.resetSouthMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.resetSouthMetrics.mock.calls[0].arguments[0], southId);
  });

  it('should test south connection', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;
    southService.testSouth.mock.mockImplementation(async () => ({ items: [] }));

    await controller.testConnection(southId, southType, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [southId, southType, settings]);
  });

  it('should wrap errors when testing south connection', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;
    southService.testSouth.mock.mockImplementation(async () => {
      throw new Error('South connection failure');
    });

    try {
      await controller.testConnection(southId, southType, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'South connection failure');
    }
    assert.strictEqual(southService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [southId, southType, settings]);
  });

  it('should test a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };

    const mockResult = {
      raw: { type: 'file', filePath: '/path/to/file.json', content: '{"key": "value"}' } as OIBusContent,
      transformed: null,
      connectionDuration: 12,
      queryDuration: 34
    };
    southService.testItem.mock.mockImplementation(async () => mockResult);

    const result = await controller.testItem(southId, southType, itemName, requestBody, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.testItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      southId,
      southType,
      itemName,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    ]);
    assert.deepStrictEqual(result, mockResult);
  });

  it('should wrap errors when testing a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };
    southService.testItem.mock.mockImplementation(async () => {
      throw new Error('South item failure');
    });

    try {
      await controller.testItem(southId, southType, itemName, requestBody, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'South item failure');
    }
    assert.strictEqual(southService.testItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      southId,
      southType,
      itemName,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    ]);
  });

  it('should test a discovery query', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const requestBody = { southSettings: testData.south.command.settings, query: 'SELECT 1' };
    const mockResult = [{ name: 'sensor1', unit: 'C' }];
    southService.testDiscoveryQuery.mock.mockImplementation(async () => mockResult);

    const result = await controller.testDiscoveryQuery(southId, southType, requestBody, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.testDiscoveryQuery.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testDiscoveryQuery.mock.calls[0].arguments, [
      southId,
      southType,
      requestBody.southSettings,
      requestBody.query
    ]);
    assert.deepStrictEqual(result, mockResult);
  });

  it('should wrap errors when testing a discovery query', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const requestBody = { southSettings: testData.south.command.settings, query: 'SELECT 1' };
    southService.testDiscoveryQuery.mock.mockImplementation(async () => {
      throw new Error('Discovery query failure');
    });

    try {
      await controller.testDiscoveryQuery(southId, southType, requestBody, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'Discovery query failure');
    }
    assert.strictEqual(southService.testDiscoveryQuery.mock.calls.length, 1);
  });

  it('should preview a configuration workflow as currently edited', async () => {
    const requestBody = {
      southSettings: testData.south.command.settings,
      workflowId: 'workflowId1',
      workflow: {
        id: 'workflowId1',
        name: 'workflow',
        description: null,
        discoveryScope: {},
        identityKeyFields: [],
        fieldProcesses: [],
        eligibilityFilter: [],
        itemFieldMapping: null,
        pushToOIAnalytics: true,
        scanModeId: null,
        enabled: true
      }
    };
    const previewResult = {
      discoveredCount: 1,
      eligibleCount: 1,
      entries: [],
      records: [{ name: 'sensor1' }],
      samples: { name: ['sensor1'] }
    };
    configurationWorkflowRunService.previewCommand.mock.mockImplementation(async () => previewResult);

    const result = await controller.testWorkflowPreview(
      testData.south.list[0].id,
      testData.south.command.type,
      requestBody,
      mockRequest as CustomExpressRequest
    );

    assert.deepStrictEqual(configurationWorkflowRunService.previewCommand.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.command.type,
      requestBody.southSettings,
      'workflowId1',
      requestBody.workflow
    ]);
    assert.deepStrictEqual(result, previewResult);
  });

  it('should test a field process on values', () => {
    const result = controller.testFieldProcess('create', {
      operations: [{ type: 'number-operation', operator: 'multiply', operand: 10 }],
      values: ['1.5', 'abc', null]
    });

    assert.deepStrictEqual(result, [
      { value: '1.5', result: 15, error: null },
      { value: 'abc', result: null, error: '"abc" is not a number' },
      { value: null, result: null, error: null }
    ]);
  });

  it('should map what a discovery scope finds to new items', async () => {
    const items: Array<SouthConnectorItemCommandDTO> = [{ ...testData.south.itemCommand, id: null }];
    configurationWorkflowRunService.discoverItems.mock.mockImplementation(async () => items);
    const requestBody = {
      southSettings: testData.south.command.settings,
      discoveryScope: { nodeIds: ['ns=1;s=Reactor'] },
      itemFieldMapping: { name: '{{path}}' }
    };

    const result = await controller.discoverItems('create', testData.south.command.type, requestBody, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(configurationWorkflowRunService.discoverItems.mock.calls[0].arguments, [
      'create',
      testData.south.command.type,
      requestBody.southSettings,
      requestBody.discoveryScope,
      requestBody.itemFieldMapping
    ]);
    assert.deepStrictEqual(result, items);
  });

  it('should wrap errors when mapping what a discovery scope finds to new items', async () => {
    configurationWorkflowRunService.discoverItems.mock.mockImplementation(async () => {
      throw new Error('Discovery failure');
    });

    await assert.rejects(
      controller.discoverItems(
        'create',
        testData.south.command.type,
        { southSettings: testData.south.command.settings, discoveryScope: {}, itemFieldMapping: {} },
        mockRequest as CustomExpressRequest
      ),
      new OIBusTestingError('Discovery failure')
    );
  });

  it('should wrap errors when previewing a configuration workflow as currently edited', async () => {
    configurationWorkflowRunService.previewCommand.mock.mockImplementation(async () => {
      throw new Error('Preview failure');
    });

    await assert.rejects(
      controller.testWorkflowPreview(
        'create',
        testData.south.command.type,
        { southSettings: testData.south.command.settings, workflowId: null, workflow: {} as never },
        mockRequest as CustomExpressRequest
      ),
      new OIBusTestingError('Preview failure')
    );
  });

  it('should start a south explore session', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;
    const startResult: SouthExploreStartResult = {
      sessionId: 'sessionId',
      entries: [{ id: 'n1', name: 'N1', metadata: { type: 'Object' }, hasChildren: true }]
    };
    southService.startExplore.mock.mockImplementation(async () => startResult);

    const result = await controller.startExplore(southId, southType, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.startExplore.mock.calls.length, 1);
    assert.deepStrictEqual(southService.startExplore.mock.calls[0].arguments, [southId, southType, settings]);
    assert.deepStrictEqual(result, startResult);
  });

  it('should wrap errors when starting a south explore session', async () => {
    southService.startExplore.mock.mockImplementation(async () => {
      throw new Error('Explore start failure');
    });

    try {
      await controller.startExplore(
        testData.south.list[0].id,
        testData.south.command.type,
        testData.south.command.settings,
        mockRequest as CustomExpressRequest
      );
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'Explore start failure');
    }
  });

  it('should browse a south explore session', async () => {
    const browseResult: SouthExploreBrowseResult = {
      entries: [{ id: 'child', name: 'Child', metadata: { type: 'file' }, hasChildren: false }]
    };
    southService.browseExplore.mock.mockImplementation(async () => browseResult);

    const result = await controller.browseExplore(
      testData.south.list[0].id,
      'sessionId',
      { parentId: 'parent' },
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(southService.browseExplore.mock.calls.length, 1);
    assert.deepStrictEqual(southService.browseExplore.mock.calls[0].arguments, ['sessionId', 'parent']);
    assert.deepStrictEqual(result, browseResult);
  });

  it('should wrap errors when browsing a south explore session', async () => {
    southService.browseExplore.mock.mockImplementation(async () => {
      throw new Error('Explore browse failure');
    });

    try {
      await controller.browseExplore(testData.south.list[0].id, 'sessionId', { parentId: null }, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'Explore browse failure');
    }
  });

  it('should close a south explore session', async () => {
    southService.closeExplore.mock.mockImplementation(async () => undefined);

    await controller.closeExplore(testData.south.list[0].id, 'sessionId', mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.closeExplore.mock.calls.length, 1);
    assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, ['sessionId']);
  });

  it('should return a list of south connector items', async () => {
    const southId = testData.south.list[0].id;
    const mockItems = testData.south.list[0].items;
    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    southService.listItems.mock.mockImplementation(() => mockItems);

    const result = await controller.listItems(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.listItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.listItems.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(result, mockItems);
  });

  it('should search south connector items', async () => {
    const southId = testData.south.list[0].id;
    const page = 1;
    const name = 'test';
    const scanModeId = 'scanModeId';
    const enabled = false;

    const searchParams: SouthConnectorItemSearchParam = {
      name,
      scanModeId,
      enabled,
      page
    };

    const mockPageResult = {
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: page,
      totalPages: 1
    };
    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    southService.searchItems.mock.mockImplementation(() => mockPageResult);

    const result = await controller.searchItems(southId, name, scanModeId, enabled, page, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.searchItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.searchItems.mock.calls[0].arguments, [southId, searchParams]);
    assert.deepStrictEqual(result, mockPageResult);
  });

  it('should search south connector items with default parameters', async () => {
    const southId = testData.south.list[0].id;

    const mockPageResult = {
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    };
    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    southService.searchItems.mock.mockImplementation(() => mockPageResult);

    const result = await controller.searchItems(southId, undefined, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.searchItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.searchItems.mock.calls[0].arguments, [
      southId,
      { page: 0, name: undefined, scanModeId: undefined, enabled: undefined }
    ]);
    assert.deepStrictEqual(result, {
      ...mockPageResult,
      content: mockPageResult.content
    });
  });

  it('should return a specific south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const mockItem = testData.south.list[0].items[0];

    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    southService.findItemById.mock.mockImplementation(() => mockItem);

    const result = await controller.findItemById(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.findItemById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findItemById.mock.calls[0].arguments, [southId, itemId]);
    assert.deepStrictEqual(result, mockItem);
  });

  it('should get item last value', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const mockLastValue = {
      itemLastValue: {
        itemId,
        itemName: testData.south.list[0].items[0].name,
        groupId: null,
        groupName: '',
        queryTime: '2024-01-01T00:00:00.000Z',
        value: { temperature: 42 },
        trackedInstant: '2024-01-02T00:00:00.000Z'
      },
      groupLastValue: null
    };
    southService.getItemLastValue.mock.mockImplementation(() => mockLastValue);

    const result = await controller.getItemLastValue(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getItemLastValue.mock.calls.length, 1);
    assert.deepStrictEqual(southService.getItemLastValue.mock.calls[0].arguments, [southId, itemId]);
    assert.deepStrictEqual(result, mockLastValue);
  });

  it('should create a new south connector item', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthConnectorItemCommandDTO = testData.south.itemCommand;
    const createdItem = testData.south.list[0].items[0];

    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    southService.createItem.mock.mockImplementation(async () => createdItem);

    const result = await controller.createItem(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.createItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.createItem.mock.calls[0].arguments, [southId, command, 'test']);
    assert.deepStrictEqual(result, createdItem);
  });

  it('should update a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const command: SouthConnectorItemCommandDTO = testData.south.itemCommand;
    southService.updateItem.mock.mockImplementation(async () => undefined);

    await controller.updateItem(southId, itemId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.updateItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.updateItem.mock.calls[0].arguments, [southId, itemId, command, 'test']);
  });

  it('should enable a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southService.enableItem.mock.mockImplementation(async () => undefined);

    await controller.enableItem(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.enableItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.enableItem.mock.calls[0].arguments, [southId, itemId]);
  });

  it('should disable a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southService.disableItem.mock.mockImplementation(async () => undefined);

    await controller.disableItem(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.disableItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.disableItem.mock.calls[0].arguments, [southId, itemId]);
  });

  it('should enable a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);
    southService.enableItems.mock.mockImplementation(async () => undefined);

    await controller.enableItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.enableItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.enableItems.mock.calls[0].arguments, [southId, itemIds]);
  });

  it('should disable a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);
    southService.disableItems.mock.mockImplementation(async () => undefined);

    await controller.disableItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.disableItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.disableItems.mock.calls[0].arguments, [southId, itemIds]);
  });

  it('should delete a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);
    southService.deleteItems.mock.mockImplementation(async () => undefined);

    await controller.deleteItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteItems.mock.calls[0].arguments, [southId, itemIds, 'test']);
  });

  it('should delete an item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southService.deleteItem.mock.mockImplementation(async () => undefined);

    await controller.deleteItem(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteItem.mock.calls[0].arguments, [southId, itemId, 'test']);
  });

  it('should delete all items from a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.deleteAllItems.mock.mockImplementation(async () => undefined);

    await controller.deleteAllItems(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteAllItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteAllItems.mock.calls[0].arguments, [southId, 'test']);
  });

  it('should convert items to CSV', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;

    southService.getManifest.mock.mockImplementation(() => testData.south.manifest);
    const readFileMock = mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    await controller.itemsToCsv(southType, delimiter, itemsFile, mockRequest as CustomExpressRequest);

    assert.strictEqual(readFileMock.mock.calls.length, 1);
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[0], 'myFile.csv');
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[1], 'utf8');
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments[0], 'items.csv');
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments[0], 'text/csv; charset=utf-8');
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments[0], 200);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments[0], 'csv content');
    assert.strictEqual(unlinkMock.mock.calls.length, 1);
  });

  it('should not throw an error if items files unlink fails', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;

    southService.getManifest.mock.mockImplementation(() => testData.south.manifest);
    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });

    await assert.doesNotReject(controller.itemsToCsv(southType, delimiter, itemsFile, mockRequest as CustomExpressRequest));
  });

  it('should throw an error if items files is missing', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';

    await assert.rejects(controller.itemsToCsv(southType, delimiter, undefined!, mockRequest as CustomExpressRequest), {
      message: 'Missing "items" file'
    });
  });

  it('should export items to CSV', async () => {
    const southId = testData.south.list[0].id;
    const delimiter = ',';
    const command = { delimiter };

    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    southService.getManifest.mock.mockImplementation(() => testData.south.manifest);
    scanModeService.list.mock.mockImplementation(() => []);

    await controller.exportItems(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments[0], 'items.csv');
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments[0], 'text/csv; charset=utf-8');
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments[0], 200);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments[0], 'csv content');
  });

  it('should check CSV import and return validation results', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsToImportFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;
    const currentItemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    const csvContent = 'id,name\n1,item1';
    const jsonContent = JSON.stringify([{ id: '1', name: 'item1' }]);
    let readCallCount = 0;
    const readFileMock = mock.method(fs, 'readFile', async () => {
      readCallCount++;
      return readCallCount === 1 ? csvContent : jsonContent;
    });
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    const mockResult = {
      items: [{ id: '1', name: 'item1' }] as Array<SouthConnectorItemDTO>,
      errors: []
    };
    southService.checkImportItems.mock.mockImplementation(async () => mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
      'false',
      itemsToImportFile,
      currentItemsFile,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(readFileMock.mock.calls.length, 2);
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[0], 'myFile.csv');
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[1], 'utf8');
    assert.deepStrictEqual(readFileMock.mock.calls[1].arguments[0], 'myFile.json');
    assert.deepStrictEqual(readFileMock.mock.calls[1].arguments[1], 'utf8');
    assert.strictEqual(southService.checkImportItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [
      southType,
      csvContent,
      delimiter,
      JSON.parse(jsonContent)
    ]);
    assert.deepStrictEqual(result, mockResult);
    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should throw an error if itemsToImport or currentItems files are missing in checkImportItems', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsToImportFile = {
      buffer: Buffer.from('id,name\n1,item1')
    } as Express.Multer.File;

    await assert.rejects(
      controller.checkImportItems(southType, delimiter, 'false', itemsToImportFile, undefined!, mockRequest as CustomExpressRequest),
      { message: 'Missing "itemsToImport" or "currentItems"' }
    );
  });

  it('should check CSV import with an empty existing items list when deleteItemsNotPresent is true', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsToImportFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;
    const currentItemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    const csvContent = 'id,name\n1,item1';
    const readFileMock = mock.method(fs, 'readFile', async () => csvContent);
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    const mockResult = {
      items: [{ id: '1', name: 'item1' }] as Array<SouthConnectorItemDTO>,
      errors: []
    };
    southService.checkImportItems.mock.mockImplementation(async () => mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
      'true',
      itemsToImportFile,
      currentItemsFile,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(readFileMock.mock.calls.length, 1);
    assert.strictEqual(southService.checkImportItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [southType, csvContent, delimiter, []]);
    assert.deepStrictEqual(result, mockResult);
    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should not throw an error if the unlink calls fail in checkImportItems', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsToImportFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;
    const currentItemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1' }]));
    mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });
    southService.checkImportItems.mock.mockImplementation(async () => ({ items: [], errors: [] }));

    await assert.doesNotReject(
      controller.checkImportItems(southType, delimiter, 'false', itemsToImportFile, currentItemsFile, mockRequest as CustomExpressRequest)
    );
  });

  it('should import items from CSV', async () => {
    const southId = testData.south.list[0].id;
    const itemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    southService.importItems.mock.mockImplementation(async () => undefined);
    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => undefined);

    await controller.importItems(southId, itemsFile, 'false', mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.importItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.importItems.mock.calls[0].arguments, [
      southId,
      [{ id: '1', name: 'item1', scanModeName: 'scan1' }],
      'test',
      false
    ]);
  });

  it('should throw an error if items file is missing in importItems', async () => {
    const southId = testData.south.list[0].id;

    await assert.rejects(controller.importItems(southId, undefined!, 'false', mockRequest as CustomExpressRequest), {
      message: 'Missing file "items"'
    });
  });

  it('should not throw an error if items files unlink fails when importing items', async () => {
    const itemsFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;

    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });

    await assert.doesNotReject(controller.importItems('southId', itemsFile, 'false', mockRequest as CustomExpressRequest));
  });

  it('should list groups for a south connector', async () => {
    const southId = testData.south.list[0].id;
    const mockGroups: Array<SouthItemGroupEntity> = [
      {
        id: 'group1',
        createdBy: '',
        updatedBy: '',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        name: 'Group 1',
        southId,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        emptyIntervalStrategy: null,
        cachingStrategy: null,
        items: []
      }
    ];
    southService.getGroups.mock.mockImplementation(() => mockGroups);

    const result = await controller.listGroups(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getGroups.mock.calls.length, 1);
    assert.deepStrictEqual(southService.getGroups.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(result, mockGroups);
  });

  it('should get a specific group by id', async () => {
    const southId = testData.south.list[0].id;
    const groupId = 'group1';
    const mockGroup: SouthItemGroupEntity = {
      id: 'group1',
      createdBy: '',
      updatedBy: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      name: 'Group 1',
      southId,
      scanMode: testData.scanMode.list[0],
      startTimeOffset: null,
      endTimeOffset: null,
      maxReadInterval: null,
      readDelay: 0,
      recoveryStrategy: null,
      emptyIntervalStrategy: null,
      cachingStrategy: null,
      items: []
    };
    southService.getGroup.mock.mockImplementation(() => mockGroup);

    const result = await controller.getGroup(southId, groupId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.getGroup.mock.calls[0].arguments, [southId, groupId]);
    assert.deepStrictEqual(result, mockGroup);
  });

  it('should create a group', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthItemGroupCommandDTO = {
      id: null,
      standardSettings: {
        name: 'New Group',
        scanModeId: testData.scanMode.list[0].id
      },
      historySettings: {
        startTimeOffset: 5,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        emptyIntervalStrategy: null,
        cachingStrategy: null
      }
    };
    const mockCreatedGroup: SouthItemGroupEntity = {
      id: 'newGroupId',
      createdBy: '',
      updatedBy: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      name: 'New Group',
      southId,
      scanMode: testData.scanMode.list[0],
      startTimeOffset: 5,
      endTimeOffset: null,
      maxReadInterval: null,
      readDelay: 0,
      recoveryStrategy: null,
      emptyIntervalStrategy: null,
      cachingStrategy: null,
      items: []
    };
    southService.createGroup.mock.mockImplementation(() => mockCreatedGroup);

    const result = await controller.createGroup(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.createGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.createGroup.mock.calls[0].arguments, [southId, command, 'test']);
    assert.deepStrictEqual(result, mockCreatedGroup);
  });

  it('should update a group', async () => {
    const southId = testData.south.list[0].id;
    const groupId = 'group1';
    const command: SouthItemGroupCommandDTO = {
      id: null,
      standardSettings: {
        name: 'Updated Group',
        scanModeId: testData.scanMode.list[1].id
      },
      historySettings: {
        startTimeOffset: 10,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        emptyIntervalStrategy: null,
        cachingStrategy: null
      }
    };
    southService.updateGroup.mock.mockImplementation(async () => ({}) as SouthItemGroupEntity);

    await controller.updateGroup(southId, groupId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.updateGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.updateGroup.mock.calls[0].arguments, [southId, groupId, 'test', command]);
  });

  it('should delete a group', async () => {
    const southId = testData.south.list[0].id;
    const groupId = 'group1';
    southService.deleteGroup.mock.mockImplementation(async () => undefined);

    await controller.deleteGroup(southId, groupId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteGroup.mock.calls[0].arguments, [southId, groupId, 'test']);
  });

  it('should move items to a group', async () => {
    const southId = testData.south.list[0].id;
    const body = {
      itemIds: [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id],
      groupId: 'group1'
    };
    southService.moveItemsToGroup.mock.mockImplementation(async () => undefined);

    await controller.moveItemsToGroup(southId, body, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.moveItemsToGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.moveItemsToGroup.mock.calls[0].arguments, [southId, body.itemIds, body.groupId]);
  });

  it('should remove items from groups when groupId is null', async () => {
    const southId = testData.south.list[0].id;
    const body = {
      itemIds: [testData.south.list[0].items[0].id],
      groupId: null
    };
    southService.moveItemsToGroup.mock.mockImplementation(async () => undefined);

    await controller.moveItemsToGroup(southId, body, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.moveItemsToGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.moveItemsToGroup.mock.calls[0].arguments, [southId, body.itemIds, null]);
  });
});
