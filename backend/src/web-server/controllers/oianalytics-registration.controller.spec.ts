import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { RegistrationSettingsCommandDTO } from '../../../shared/model/engine.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import type { OIAnalyticsRegistrationController as OIAnalyticsRegistrationControllerShape } from './oianalytics-registration.controller';

const nodeRequire = createRequire(import.meta.url);

let mockRegistrationServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let OIAnalyticsRegistrationController: typeof OIAnalyticsRegistrationControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockRegistrationServiceModule = { toOIAnalyticsRegistrationDTO: mock.fn((settings: unknown) => settings) };
  mockModule(nodeRequire, '../../service/oia/oianalytics-registration.service', mockRegistrationServiceModule);
  const mod = reloadModule<{ OIAnalyticsRegistrationController: typeof OIAnalyticsRegistrationControllerShape }>(
    nodeRequire,
    './oianalytics-registration.controller'
  );
  OIAnalyticsRegistrationController = mod.OIAnalyticsRegistrationController;
});

describe('OIAnalyticsRegistrationController', () => {
  let controller: OIAnalyticsRegistrationControllerShape;
  let registrationService: OIAnalyticsRegistrationServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    registrationService = new OIAnalyticsRegistrationServiceMock();
    mockRequest = {
      user: { id: testData.users.list[0].id, login: testData.users.list[0].login },
      services: {
        oIAnalyticsRegistrationService: registrationService
      }
    } as Partial<CustomExpressRequest>;
    mockRegistrationServiceModule.toOIAnalyticsRegistrationDTO = mock.fn((settings: unknown) => settings);
    controller = new OIAnalyticsRegistrationController();
  });

  it('should return registration settings', async () => {
    const mockSettings = testData.oIAnalytics.registration.completed;
    registrationService.getRegistrationSettings = mock.fn(() => mockSettings);

    const result = await controller.getRegistrationSettings(mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.getRegistrationSettings.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockSettings);
  });

  it('should register with OIAnalytics service', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    registrationService.register = mock.fn(async () => undefined);

    await controller.register(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.register.mock.calls.length, 1);
    assert.deepStrictEqual(registrationService.register.mock.calls[0].arguments, [command, testData.users.list[0].id]);
  });

  it('should update registration settings', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    registrationService.editRegistrationSettings = mock.fn(async () => undefined);

    await controller.editRegistrationSettings(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.editRegistrationSettings.mock.calls.length, 1);
    assert.deepStrictEqual(registrationService.editRegistrationSettings.mock.calls[0].arguments, [command, testData.users.list[0].id]);
  });

  it('should unregister from OIAnalytics service', async () => {
    registrationService.unregister = mock.fn(async () => undefined);

    await controller.unregister(mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.unregister.mock.calls.length, 1);
  });

  it('should test connection', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    registrationService.testConnection = mock.fn(async () => undefined);

    await controller.testConnection(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.testConnection.mock.calls.length, 1);
    assert.deepStrictEqual(registrationService.testConnection.mock.calls[0].arguments, [command]);
  });
});
