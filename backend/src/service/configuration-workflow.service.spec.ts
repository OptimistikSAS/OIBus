import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import ConfigurationWorkflowService from './configuration-workflow.service';
import ConfigurationWorkflowRepositoryMock from '../tests/__mocks__/repository/config/configuration-workflow-repository.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import testData from '../tests/utils/test-data';
import { ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import { ConfigurationWorkflowCommandDTO } from '../../shared/model/configuration-workflow.model';
import { NotFoundError, OIBusValidationError } from '../model/types';

let configurationWorkflowRepository: ConfigurationWorkflowRepositoryMock;
let southConnectorRepository: SouthConnectorRepositoryMock;
let scanModeRepository: ScanModeRepositoryMock;
let service: ConfigurationWorkflowService;

const selfScopedCommand: ConfigurationWorkflowCommandDTO = {
  name: 'Reactor discovery',
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
  itemFieldMapping: { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' },
  remoteFieldMapping: null,
  scanModeId: null,
  enabled: true
};

const existingWorkflow: ConfigurationWorkflowEntity = {
  id: 'workflowId1',
  name: 'Reactor discovery',
  southId: testData.south.list[0].id,
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
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
    service = new ConfigurationWorkflowService(configurationWorkflowRepository, southConnectorRepository, scanModeRepository);
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
      assert.throws(
        () => service.create('badSouth', selfScopedCommand, 'userTest'),
        new NotFoundError('South connector "badSouth" not found')
      );
    });

    it('should throw when targetItemId is set but the item does not exist', () => {
      southConnectorRepository.findItemById.mock.mockImplementation(() => null);
      assert.throws(
        () => service.create(testData.south.list[0].id, { ...selfScopedCommand, targetItemId: 'missingItem' }, 'userTest'),
        new NotFoundError('South item "missingItem" not found')
      );
    });

    it('should not check the item when targetItemId is null (self-scoped)', () => {
      service.create(testData.south.list[0].id, selfScopedCommand, 'userTest');
      assert.strictEqual(southConnectorRepository.findItemById.mock.calls.length, 0);
    });

    it('should throw when both itemFieldMapping and remoteFieldMapping are null', () => {
      assert.throws(
        () =>
          service.create(testData.south.list[0].id, { ...selfScopedCommand, itemFieldMapping: null, remoteFieldMapping: null }, 'userTest'),
        new OIBusValidationError('At least one of itemFieldMapping or remoteFieldMapping must be set')
      );
    });

    it('should allow itemFieldMapping null when remoteFieldMapping is set and targetItemId is set (remote-metadata-only)', () => {
      southConnectorRepository.findItemById.mock.mockImplementation(() => testData.south.list[0].items[0]);
      service.create(
        testData.south.list[0].id,
        {
          ...selfScopedCommand,
          targetItemId: testData.south.list[0].items[0].id,
          itemFieldMapping: null,
          remoteFieldMapping: { unit: '{{unit}}' }
        },
        'userTest'
      );
      assert.strictEqual(configurationWorkflowRepository.create.mock.calls.length, 1);
    });

    it('should throw when itemFieldMapping is null and targetItemId is also null (no way to know which item)', () => {
      assert.throws(
        () =>
          service.create(
            testData.south.list[0].id,
            { ...selfScopedCommand, targetItemId: null, itemFieldMapping: null, remoteFieldMapping: { unit: '{{unit}}' } },
            'userTest'
          ),
        new OIBusValidationError('targetItemId is required when itemFieldMapping is not set')
      );
    });

    it('should throw when a workflow with the same name already exists for this south connector', () => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => existingWorkflow);
      assert.throws(
        () => service.create(testData.south.list[0].id, selfScopedCommand, 'userTest'),
        new OIBusValidationError(`A configuration workflow with name "${selfScopedCommand.name}" already exists for this south connector`)
      );
    });

    it('should default scanMode to null when scanModeId is null (manual-only)', () => {
      service.create(testData.south.list[0].id, selfScopedCommand, 'userTest');
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.strictEqual((createCall.arguments[0] as { scanMode: unknown }).scanMode, null);
    });

    it('should resolve scanModeId into a full ScanMode via the scan mode repository', () => {
      scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
      service.create(testData.south.list[0].id, { ...selfScopedCommand, scanModeId: testData.scanMode.list[0].id }, 'userTest');
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.deepStrictEqual((createCall.arguments[0] as { scanMode: unknown }).scanMode, testData.scanMode.list[0]);
    });

    it('should throw when scanModeId does not match any existing scan mode', () => {
      scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
      assert.throws(() => service.create(testData.south.list[0].id, { ...selfScopedCommand, scanModeId: 'badScanMode' }, 'userTest'));
    });

    it('should create the workflow scoped to the given south connector id', () => {
      const created = service.create(testData.south.list[0].id, selfScopedCommand, 'userTest');
      assert.strictEqual(created, existingWorkflow);
      const createCall = configurationWorkflowRepository.create.mock.calls[0];
      assert.strictEqual((createCall.arguments[0] as { southId: string }).southId, testData.south.list[0].id);
      assert.strictEqual(createCall.arguments[1], 'userTest');
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
        () => service.update(testData.south.list[0].id, 'workflowId1', selfScopedCommand, 'updateUser'),
        new NotFoundError('Configuration workflow "workflowId1" not found')
      );
    });

    it('should allow renaming to its own current name (excluded from the duplicate check)', () => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => existingWorkflow);
      service.update(testData.south.list[0].id, existingWorkflow.id, selfScopedCommand, 'updateUser');
      assert.strictEqual(configurationWorkflowRepository.update.mock.calls.length, 1);
    });

    it('should throw when renaming to a name already used by a different workflow', () => {
      configurationWorkflowRepository.findByNameAndSouthId.mock.mockImplementation(() => ({ ...existingWorkflow, id: 'otherWorkflowId' }));
      assert.throws(
        () => service.update(testData.south.list[0].id, existingWorkflow.id, selfScopedCommand, 'updateUser'),
        new OIBusValidationError(`A configuration workflow with name "${selfScopedCommand.name}" already exists for this south connector`)
      );
    });

    it('should update and return the refreshed workflow', () => {
      const updated = service.update(testData.south.list[0].id, existingWorkflow.id, selfScopedCommand, 'updateUser');
      assert.strictEqual(updated, existingWorkflow);
      const updateCall = configurationWorkflowRepository.update.mock.calls[0];
      assert.strictEqual(updateCall.arguments[0], existingWorkflow.id);
      assert.strictEqual(updateCall.arguments[2], 'updateUser');
    });

    it('should throw if the workflow disappears between update and re-fetch', () => {
      configurationWorkflowRepository.findById.mock.mockImplementationOnce(() => existingWorkflow, 0);
      configurationWorkflowRepository.findById.mock.mockImplementationOnce(() => null, 1);
      assert.throws(
        () => service.update(testData.south.list[0].id, existingWorkflow.id, selfScopedCommand, 'updateUser'),
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
  });
});
