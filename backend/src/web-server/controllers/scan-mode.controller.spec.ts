import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ScanModeCommandDTO, ValidatedCronExpression } from '../../../shared/model/scan-mode.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import type { ScanModeController as ScanModeControllerShape } from './scan-mode.controller';

const nodeRequire = createRequire(import.meta.url);

let mockScanModeServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let ScanModeController: typeof ScanModeControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockScanModeServiceModule = {
    toScanModeDTO: mock.fn((scanMode: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return scanMode;
    })
  };
  mockModule(nodeRequire, '../../service/scan-mode.service', mockScanModeServiceModule);
  const mod = reloadModule<{ ScanModeController: typeof ScanModeControllerShape }>(nodeRequire, './scan-mode.controller');
  ScanModeController = mod.ScanModeController;
});

describe('ScanModeController', () => {
  let controller: ScanModeControllerShape;
  let scanModeService: ScanModeServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    scanModeService = new ScanModeServiceMock();
    userService = new UserServiceMock();
    mockRequest = {
      services: Object.assign({} as CustomExpressRequest['services'], { scanModeService, userService }),
      user: { id: 'test', login: 'testUser' }
    } as Partial<CustomExpressRequest>;
    mockScanModeServiceModule.toScanModeDTO = mock.fn((scanMode: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return scanMode;
    });
    controller = new ScanModeController();
  });

  it('should return a list of scan modes', async () => {
    const mockScanModes = testData.scanMode.list;
    scanModeService.list = mock.fn(() => mockScanModes);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockScanModes);
  });

  it('should return a scan mode by ID', async () => {
    const mockScanMode = testData.scanMode.list[0];
    const scanModeId = mockScanMode.id;
    scanModeService.findById = mock.fn(() => mockScanMode);

    const result = await controller.findById(scanModeId, mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(scanModeService.findById.mock.calls[0].arguments[0], scanModeId);
    assert.deepStrictEqual(result, mockScanMode);
  });

  it('should create a new scan mode', async () => {
    const command: ScanModeCommandDTO = testData.scanMode.command;
    const createdScanMode = testData.scanMode.list[0];
    scanModeService.create = mock.fn(async () => createdScanMode);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.create.mock.calls.length, 1);
    assert.deepStrictEqual(scanModeService.create.mock.calls[0].arguments, [command, 'test']);
    assert.deepStrictEqual(result, createdScanMode);
  });

  it('should update an existing scan mode', async () => {
    const scanModeId = testData.scanMode.list[0].id;
    const command: ScanModeCommandDTO = testData.scanMode.command;
    scanModeService.update = mock.fn(async () => undefined);

    await controller.update(scanModeId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.update.mock.calls.length, 1);
    assert.deepStrictEqual(scanModeService.update.mock.calls[0].arguments, [scanModeId, command, 'test']);
  });

  it('should delete a scan mode', async () => {
    const scanModeId = testData.scanMode.list[0].id;
    scanModeService.delete = mock.fn(async () => undefined);

    await controller.delete(scanModeId, mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(scanModeService.delete.mock.calls[0].arguments[0], scanModeId);
  });

  it('should validate a cron expression', async () => {
    const command = { cron: testData.scanMode.command.cron };
    const validatedCronExpression: ValidatedCronExpression = {
      isValid: true,
      errorMessage: '',
      nextExecutions: [],
      humanReadableForm: ''
    };
    scanModeService.verifyCron = mock.fn(async () => validatedCronExpression);

    const result = await controller.verifyCron(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.verifyCron.mock.calls.length, 1);
    assert.deepStrictEqual(scanModeService.verifyCron.mock.calls[0].arguments[0], command);
    assert.deepStrictEqual(result, validatedCronExpression);
  });

  it('should return invalid result when cron expression is not valid', async () => {
    const command = { cron: 'not-a-cron' };
    const validatedCronExpression: ValidatedCronExpression = {
      isValid: false,
      errorMessage: 'Invalid cron expression',
      nextExecutions: [],
      humanReadableForm: ''
    };
    scanModeService.verifyCron = mock.fn(async () => validatedCronExpression);

    const result = await controller.verifyCron(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(scanModeService.verifyCron.mock.calls.length, 1);
    assert.deepStrictEqual(result, validatedCronExpression);
  });
});
