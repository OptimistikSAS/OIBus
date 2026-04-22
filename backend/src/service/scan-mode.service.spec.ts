import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import DataStreamEngine from '../engine/data-stream-engine';
import ScanModeService from './scan-mode.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import testData from '../tests/utils/test-data';
import { scanModeSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';

let validator: { validate: ReturnType<typeof mock.fn> };
let scanModeRepository: ScanModeRepositoryMock;
let southConnectorRepository: SouthConnectorRepositoryMock;
let southCacheRepository: SouthCacheRepositoryMock;
let dataStreamEngine: DataStreamEngineMock;
let oIAnalyticsMessageService: OianalyticsMessageServiceMock;
let service: ScanModeService;

describe('Scan Mode Service', () => {
  beforeEach(() => {
    validator = { validate: mock.fn() };
    scanModeRepository = new ScanModeRepositoryMock();
    southConnectorRepository = new SouthConnectorRepositoryMock();
    southCacheRepository = new SouthCacheRepositoryMock();
    dataStreamEngine = new DataStreamEngineMock(null);
    oIAnalyticsMessageService = new OianalyticsMessageServiceMock();
    scanModeRepository.findAll.mock.mockImplementation(() => []);
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => []);

    service = new ScanModeService(
      validator as unknown as JoiValidator,
      scanModeRepository as unknown as ScanModeRepository,
      southConnectorRepository as unknown as SouthConnectorRepository,
      southCacheRepository as unknown as SouthCacheRepository,
      oIAnalyticsMessageService as unknown as OIAnalyticsMessageService,
      dataStreamEngine as unknown as DataStreamEngine
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('findAll() should find all scan modes', () => {
    scanModeRepository.findAll.mock.mockImplementationOnce(() => testData.scanMode.list);

    const result = service.list();

    assert.ok(scanModeRepository.findAll.mock.calls.length > 0);
    assert.deepStrictEqual(result, testData.scanMode.list);
  });

  it('findById() should find a scan mode by id', () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0]);

    const result = service.findById(testData.scanMode.list[0].id);

    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
    assert.deepStrictEqual(result, testData.scanMode.list[0]);
  });

  it('findById() should throw not found', () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.findById(testData.scanMode.list[0].id), {
      message: `Scan mode "${testData.scanMode.list[0].id}" not found`
    });
    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
  });

  it('create() should create a scan mode', async () => {
    scanModeRepository.findAll.mock.mockImplementationOnce(() => []);
    scanModeRepository.create.mock.mockImplementationOnce(() => testData.scanMode.list[0]);

    const result = await service.create(testData.scanMode.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [scanModeSchema, testData.scanMode.command]);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
    assert.deepStrictEqual(result, testData.scanMode.list[0]);
  });

  it('create() should not create a scan mode with duplicate name', async () => {
    scanModeRepository.findAll.mock.mockImplementationOnce(() => [{ id: 'existing-id', name: testData.scanMode.command.name }]);

    await assert.rejects(() => service.create(testData.scanMode.command, 'userTest'), {
      message: `Scan mode name "${testData.scanMode.command.name}" already exists`
    });
  });

  it('update() should update a scan mode', async () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0], 0);
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[1], 1);
    scanModeRepository.findAll.mock.mockImplementationOnce(() => testData.scanMode.list);

    await service.update(testData.scanMode.list[0].id, testData.scanMode.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [scanModeSchema, testData.scanMode.command]);
    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[1].arguments, [testData.scanMode.list[0].id]);
    assert.strictEqual(scanModeRepository.findById.mock.calls.length, 2);
    assert.deepStrictEqual(scanModeRepository.update.mock.calls[0].arguments, [
      testData.scanMode.list[0].id,
      testData.scanMode.command,
      'userTest'
    ]);
    assert.deepStrictEqual(dataStreamEngine.updateScanMode.mock.calls[0].arguments, [testData.scanMode.list[1]]);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
  });

  it('update() should update a scan mode without changing the name', async () => {
    const command = JSON.parse(JSON.stringify(testData.scanMode.command));
    command.name = testData.scanMode.list[0].name;
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0], 0);
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[1], 1);

    await service.update(testData.scanMode.list[0].id, command, 'userTest');

    assert.deepStrictEqual(scanModeRepository.update.mock.calls[0].arguments, [testData.scanMode.list[0].id, command, 'userTest']);
    assert.deepStrictEqual(dataStreamEngine.updateScanMode.mock.calls[0].arguments, [testData.scanMode.list[1]]);
    assert.strictEqual(scanModeRepository.findAll.mock.calls.length, 0);
  });

  it('update() should update a scan mode with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.scanMode.command));
    command.name = 'Updated Scan Mode Name';
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0], 0);
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[1], 1);
    scanModeRepository.findAll.mock.mockImplementationOnce(() => testData.scanMode.list);

    await service.update(testData.scanMode.list[0].id, command, 'userTest');

    assert.deepStrictEqual(scanModeRepository.update.mock.calls[0].arguments, [testData.scanMode.list[0].id, command, 'userTest']);
    assert.deepStrictEqual(dataStreamEngine.updateScanMode.mock.calls[0].arguments, [testData.scanMode.list[1]]);
  });

  it('update() should update a scan mode and not update engine', async () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0], 0);
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0], 1);
    scanModeRepository.findAll.mock.mockImplementationOnce(() => testData.scanMode.list);

    await service.update(testData.scanMode.list[0].id, testData.scanMode.command, 'userTest');

    assert.deepStrictEqual(scanModeRepository.update.mock.calls[0].arguments, [
      testData.scanMode.list[0].id,
      testData.scanMode.command,
      'userTest'
    ]);
    assert.strictEqual(dataStreamEngine.updateScanMode.mock.calls.length, 0);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
  });

  it('update() should not update if the scan mode is not found', async () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.update(testData.scanMode.list[0].id, testData.scanMode.command, 'userTest'), {
      message: `Scan mode "${testData.scanMode.list[0].id}" not found`
    });

    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
    assert.strictEqual(scanModeRepository.update.mock.calls.length, 0);
    assert.strictEqual(dataStreamEngine.updateScanMode.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 0);
  });

  it('update() should not update a scan mode with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.scanMode.command));
    command.name = 'Duplicate Name';
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0]);
    scanModeRepository.findAll.mock.mockImplementationOnce(() => [{ id: 'other-id', name: 'Duplicate Name' }]);

    await assert.rejects(() => service.update(testData.scanMode.list[0].id, command, 'userTest'), {
      message: `Scan mode name "Duplicate Name" already exists`
    });
  });

  it('delete() should delete a scan mode', async () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => testData.scanMode.list[0]);
    southConnectorRepository.findAllSouth.mock.mockImplementationOnce(() => [{ id: 'south1' }, { id: 'south2' }]);

    const mockItem = { id: 'item1', scanMode: { id: testData.scanMode.list[0].id } };
    southConnectorRepository.findAllItemsForSouth.mock.mockImplementation(() => [mockItem]);

    await service.delete(testData.scanMode.list[0].id);

    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
    assert.deepStrictEqual(scanModeRepository.delete.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
    assert.ok(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length > 0);
  });

  it('delete() should not delete if the scan mode is not found', async () => {
    scanModeRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.delete(testData.scanMode.list[0].id), {
      message: `Scan mode "${testData.scanMode.list[0].id}" not found`
    });

    assert.deepStrictEqual(scanModeRepository.findById.mock.calls[0].arguments, [testData.scanMode.list[0].id]);
    assert.strictEqual(scanModeRepository.delete.mock.calls.length, 0);
    assert.strictEqual(southCacheRepository.dropItemValueTable.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 0);
  });

  it('verifyCron() should verify cron expression of a scan mode', async () => {
    // Use a real valid cron expression
    const result = await service.verifyCron({ cron: '* * * * * *' });

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errorMessage, '');
    assert.ok(result.nextExecutions.length > 0);
    assert.ok(result.humanReadableForm.length > 0);
  });

  it('verifyCron() should return invalid result when cron is not valid', async () => {
    // Use an invalid cron expression (too many fields → quartz cron not supported)
    const result = await service.verifyCron({ cron: 'invalid-cron-expression' });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.errorMessage.length > 0);
  });
});
