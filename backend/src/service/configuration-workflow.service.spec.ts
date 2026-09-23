import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import ConfigurationWorkflowService from './configuration-workflow.service';
import ConfigurationWorkflowRepositoryMock from '../tests/__mocks__/repository/config/configuration-workflow-repository.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import OIAnalyticsRegistrationServiceMock from '../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import testData from '../tests/utils/test-data';
import { ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import { ConfigurationWorkflowCommandDTO } from '../../shared/model/configuration-workflow.model';
import { NotFoundError, OIBusValidationError } from '../model/types';

let configurationWorkflowRepository: ConfigurationWorkflowRepositoryMock;
let southConnectorRepository: SouthConnectorRepositoryMock;
let scanModeRepository: ScanModeRepositoryMock;
let engine: DataStreamEngineMock;
let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
let service: ConfigurationWorkflowService;

const localCommand: ConfigurationWorkflowCommandDTO = {
  name: 'Reactor discovery',
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
  itemFieldMapping: { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' },
  pushToOIAnalytics: false,
  scanModeId: null,
  enabled: true
};

const existingWorkflow: ConfigurationWorkflowEntity = {
  id: 'workflowId1',
  name: 'Reactor discovery',
  southId: testData.south.list[0].id,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  pushToOIAnalytics: false,
  scanMode: null,
  enabled: true,
  createdBy: 'userTest',
  updatedBy: 'userTest',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

describe('Configuration Workflow Service', () => {
  beforeEach(() => {
    configurationWorkflowRepository = new ConfigurationWorkflowRepositoryMock();
    southConnectorRepository = new SouthConnectorRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    engine = new DataStreamEngineMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    service = new ConfigurationWorkflowService(
      configurationWorkflowRepository,
      southConnectorRepository,
      scanModeRepository,
      engine as never,
      oIAnalyticsRegistrationService
    );
    southConnectorRepository.findSouthById.mock.mockImplementation(() => testData.south.list[0]);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('findById', () => {
    it('should throw when the south connector does not exist', () => {
      southConnectorRepository.findSouthById.mock.mockImplementation(() => null);
      assert.throws(() => service.findById('badSouth', 'workflowId1'), new NotFoundError('South connector "badSouth" not found'));
    });

    it('should throw when the workflow does not exist', () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => null);
      assert.throws(
        () => service.findById(testData.south.list[0].id, 'workflowId1'),
        new NotFoundError('Configuration workflow "workflowId1" not found')
      );
    });

    it('should throw when the workflow belongs to a different south connector', () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => ({ ...existingWorkflow, southId: 'otherSouth' }));
      assert.throws(
        () => service.findById(testData.south.list[0].id, 'workflowId1'),
        new NotFoundError(`Configuration workflow "workflowId1" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should return the workflow when it exists and belongs to the south connector', () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => existingWorkflow);
      const result = service.findById(testData.south.list[0].id, 'workflowId1');
      assert.deepStrictEqual(result, existingWorkflow);
    });
  });

  describe('findBySouthId', () => {
    it('should throw when the south connector does not exist', () => {
      southConnectorRepository.findSouthById.mock.mockImplementation(() => null);
      assert.throws(() => service.findBySouthId('badSouth'), new NotFoundError('South connector "badSouth" not found'));
    });

    it('should list workflows for the south connector', () => {
      configurationWorkflowRepository.findBySouthId.mock.mockImplementation(() => [existingWorkflow]);
      const result = service.findBySouthId(testData.south.list[0].id);
      assert.deepStrictEqual(result, [existingWorkflow]);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
      configurationWorkflowRepository.create.mock.mockImplementation(() => existingWorkflow);
    });

    it('should throw when the south connector does not exist', () => {
      southConnectorRepository.findSouthById.mock.mockImplementation(() => null);
      assert.throws(() => service.create('badSouth', localCommand, 'userTest'), new NotFoundError('South connector "badSouth" not found'));
    });

    it('should throw when both itemFieldMapping and pushToOIAnalytics are set', () => {
      assert.throws(
        () => service.create(testData.south.list[0].id, { ...localCommand, pushToOIAnalytics: true }, 'userTest'),
        new OIBusValidationError('A configuration workflow cannot both create/update items and push to OIAnalytics')
      );
    });

    it('should throw when neither itemFieldMapping nor pushToOIAnalytics is set', () => {
      assert.throws(
        () => service.create(testData.south.list[0].id, { ...localCommand, itemFieldMapping: null, pushToOIAnalytics: false }, 'userTest'),
        new OIBusValidationError('A configuration workflow must either create/update items or push to OIAnalytics')
      );
    });

    it('should still create the workflow, logging a warning, when pushToOIAnalytics is set but OIBus is not registered', () => {
      oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(() => ({ status: 'NOT_REGISTERED' }) as never);
      const created = service.create(
        testData.south.list[0].id,
        { ...localCommand, itemFieldMapping: null, pushToOIAnalytics: true },
        'userTest'
      );
      assert.strictEqual(created, existingWorkflow);
      assert.strictEqual(configurationWorkflowRepository.create.mock.calls.length, 1);
      assert.strictEqual(engine.logger.warn.mock.calls.length, 1);
    });

    it('should throw when a local workflow has no identity key field', () => {
      assert.throws(
        () => service.create(testData.south.list[0].id, { ...localCommand, identityKeyFields: [] }, 'userTest'),
        new OIBusValidationError('A configuration workflow creating/updating items requires at least one identity key field')
      );
    });

    it('should store no identity key field for a remote workflow, whatever it was sent with', () => {
      service.create(testData.south.list[0].id, { ...localCommand, itemFieldMapping: null, pushToOIAnalytics: true }, 'userTest');
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.deepStrictEqual((createCall.arguments[0] as ConfigurationWorkflowEntity).identityKeyFields, []);
    });

    it('should allow a remote workflow without any identity key field', () => {
      service.create(
        testData.south.list[0].id,
        { ...localCommand, identityKeyFields: [], itemFieldMapping: null, pushToOIAnalytics: true },
        'userTest'
      );
      assert.strictEqual(configurationWorkflowRepository.create.mock.calls.length, 1);
    });

    it('should allow pushToOIAnalytics when OIBus is registered, without logging a warning', () => {
      oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(() => ({ status: 'REGISTERED' }) as never);
      service.create(testData.south.list[0].id, { ...localCommand, itemFieldMapping: null, pushToOIAnalytics: true }, 'userTest');
      assert.strictEqual(configurationWorkflowRepository.create.mock.calls.length, 1);
      assert.strictEqual(engine.logger.warn.mock.calls.length, 0);
    });

    it('should throw when a workflow with the same name already exists for this south connector', () => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => existingWorkflow);
      assert.throws(
        () => service.create(testData.south.list[0].id, localCommand, 'userTest'),
        new OIBusValidationError(`A configuration workflow with name "${localCommand.name}" already exists for this south connector`)
      );
    });

    it('should default scanMode to null when scanModeId is null (manual-only)', () => {
      service.create(testData.south.list[0].id, localCommand, 'userTest');
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.strictEqual((createCall.arguments[0] as { scanMode: unknown }).scanMode, null);
    });

    it('should resolve scanModeId into a full ScanMode via the scan mode repository', () => {
      scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
      service.create(testData.south.list[0].id, { ...localCommand, scanModeId: testData.scanMode.list[0].id }, 'userTest');
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.deepStrictEqual((createCall.arguments[0] as { scanMode: unknown }).scanMode, testData.scanMode.list[0]);
    });

    it('should throw when scanModeId does not match any existing scan mode', () => {
      scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
      assert.throws(() => service.create(testData.south.list[0].id, { ...localCommand, scanModeId: 'badScanMode' }, 'userTest'));
    });

    it('should create the workflow scoped to the given south connector id', () => {
      const created = service.create(testData.south.list[0].id, localCommand, 'userTest');
      assert.strictEqual(created, existingWorkflow);
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.strictEqual((createCall.arguments[0] as { southId: string }).southId, testData.south.list[0].id);
      assert.strictEqual(createCall.arguments[1], 'userTest');
    });

    it("should tell the engine to reload this south connector's scheduled workflows", () => {
      service.create(testData.south.list[0].id, localCommand, 'userTest');
      assert.deepStrictEqual(engine.reloadWorkflows.mock.calls[0].arguments, [testData.south.list[0].id]);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => existingWorkflow);
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
    });

    it('should throw when the workflow does not exist (ownership check reused from findById)', () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => null);
      assert.throws(
        () => service.update(testData.south.list[0].id, 'workflowId1', localCommand, 'updateUser'),
        new NotFoundError('Configuration workflow "workflowId1" not found')
      );
    });

    it('should allow renaming to its own current name (excluded from the duplicate check)', () => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => existingWorkflow);
      service.update(testData.south.list[0].id, existingWorkflow.id, localCommand, 'updateUser');
      assert.strictEqual(configurationWorkflowRepository.update.mock.calls.length, 1);
    });

    it('should throw when renaming to a name already used by a different workflow', () => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => ({ ...existingWorkflow, id: 'otherWorkflowId' }));
      assert.throws(
        () => service.update(testData.south.list[0].id, existingWorkflow.id, localCommand, 'updateUser'),
        new OIBusValidationError(`A configuration workflow with name "${localCommand.name}" already exists for this south connector`)
      );
    });

    it('should throw when both itemFieldMapping and pushToOIAnalytics are set', () => {
      assert.throws(
        () => service.update(testData.south.list[0].id, existingWorkflow.id, { ...localCommand, pushToOIAnalytics: true }, 'updateUser'),
        new OIBusValidationError('A configuration workflow cannot both create/update items and push to OIAnalytics')
      );
    });

    it('should throw when updating a local workflow to have no identity key field', () => {
      assert.throws(
        () => service.update(testData.south.list[0].id, existingWorkflow.id, { ...localCommand, identityKeyFields: [] }, 'updateUser'),
        new OIBusValidationError('A configuration workflow creating/updating items requires at least one identity key field')
      );
    });

    it('should clear identity key fields when switching a workflow to remote', () => {
      service.update(
        testData.south.list[0].id,
        existingWorkflow.id,
        { ...localCommand, itemFieldMapping: null, pushToOIAnalytics: true },
        'updateUser'
      );
      const updateCall = configurationWorkflowRepository.update.mock.calls[0];
      assert.deepStrictEqual((updateCall.arguments[1] as { identityKeyFields: Array<string> }).identityKeyFields, []);
    });

    it('should update and return the refreshed workflow', () => {
      const updated = service.update(testData.south.list[0].id, existingWorkflow.id, localCommand, 'updateUser');
      assert.strictEqual(updated, existingWorkflow);
      const updateCall = configurationWorkflowRepository.update.mock.calls[0];
      assert.strictEqual(updateCall.arguments[0], existingWorkflow.id);
      assert.strictEqual(updateCall.arguments[2], 'updateUser');
    });

    it("should tell the engine to reload this south connector's scheduled workflows", () => {
      service.update(testData.south.list[0].id, existingWorkflow.id, localCommand, 'updateUser');
      assert.deepStrictEqual(engine.reloadWorkflows.mock.calls[0].arguments, [testData.south.list[0].id]);
    });

    it('should throw if the workflow disappears between update and re-fetch', () => {
      configurationWorkflowRepository.findById.mock.mockImplementationOnce(() => existingWorkflow, 0);
      configurationWorkflowRepository.findById.mock.mockImplementationOnce(() => null, 1);
      assert.throws(
        () => service.update(testData.south.list[0].id, existingWorkflow.id, localCommand, 'updateUser'),
        new NotFoundError(`Failed to update configuration workflow "${existingWorkflow.id}"`)
      );
    });
  });

  describe('delete', () => {
    it('should throw when the workflow does not exist (ownership check reused from findById)', () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => null);
      assert.throws(
        () => service.delete(testData.south.list[0].id, 'workflowId1', 'deleteUser'),
        new NotFoundError('Configuration workflow "workflowId1" not found')
      );
    });

    it('should delete the workflow once ownership is verified', () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => existingWorkflow);
      service.delete(testData.south.list[0].id, existingWorkflow.id, 'deleteUser');
      assert.deepStrictEqual(configurationWorkflowRepository.delete.mock.calls[0].arguments, [existingWorkflow.id, 'deleteUser']);
    });

    it("should tell the engine to reload this south connector's scheduled workflows", () => {
      configurationWorkflowRepository.findById.mock.mockImplementation(() => existingWorkflow);
      service.delete(testData.south.list[0].id, existingWorkflow.id, 'deleteUser');
      assert.deepStrictEqual(engine.reloadWorkflows.mock.calls[0].arguments, [testData.south.list[0].id]);
    });
  });
});
