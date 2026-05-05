import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EngineSettingsCommandDTO, EngineSettingsUpdateResultDTO } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import type { EngineController as EngineControllerShape } from './engine.controller';

const nodeRequire = createRequire(import.meta.url);

let mockOIBusServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let EngineController: typeof EngineControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockOIBusServiceModule = { toEngineSettingsDTO: mock.fn((settings: unknown) => settings) };
  mockModule(nodeRequire, '../../service/oibus.service', mockOIBusServiceModule);
  const mod = reloadModule<{ EngineController: typeof EngineControllerShape }>(nodeRequire, './engine.controller');
  EngineController = mod.EngineController;
});

describe('EngineController', () => {
  let controller: EngineControllerShape;
  let oIBusService: OIBusServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    oIBusService = new OIBusServiceMock();
    userService = new UserServiceMock();
    mockRequest = {
      user: { id: testData.users.list[0].id, login: testData.users.list[0].login },
      services: Object.assign({} as CustomExpressRequest['services'], { oIBusService, userService })
    } as Partial<CustomExpressRequest>;
    mockOIBusServiceModule.toEngineSettingsDTO = mock.fn((settings: unknown) => settings);
    controller = new EngineController();
  });

  it('should return engine settings', async () => {
    const mockSettings = testData.engine.settings;
    oIBusService.getEngineSettings = mock.fn(() => mockSettings);

    const result = await controller.getEngineSettings(mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.getEngineSettings.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockSettings);
  });

  it('should update engine settings', async () => {
    const command: EngineSettingsCommandDTO = testData.engine.command;
    oIBusService.updateEngineSettings = mock.fn(async () => ({}) as EngineSettingsUpdateResultDTO);

    await controller.updateEngineSettings(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.updateEngineSettings.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateEngineSettings.mock.calls[0].arguments, [command, testData.users.list[0].id]);
  });

  it('should reset engine metrics', async () => {
    oIBusService.resetEngineMetrics = mock.fn(async () => undefined);

    await controller.resetEngineMetrics(mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.resetEngineMetrics.mock.calls.length, 1);
  });

  it('should restart OIBus', async () => {
    oIBusService.restart = mock.fn(async () => undefined);

    await controller.restart(mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.restart.mock.calls.length, 1);
  });

  it('should return OIBus info', async () => {
    const mockInfo = testData.engine.oIBusInfo;
    oIBusService.getInfo = mock.fn(() => mockInfo);

    const result = await controller.getInfo(mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.getInfo.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockInfo);
  });

  it('should check OIBus status', async () => {
    await controller.getOIBusStatus(mockRequest as CustomExpressRequest);
  });
});
