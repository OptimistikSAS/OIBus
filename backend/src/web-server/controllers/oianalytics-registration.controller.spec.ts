import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, beforeEach, describe, it, mock } from 'node:test';

import { RegistrationSettingsCommandDTO } from '../../../shared/model/api/engine.model';
import { ServerIdentity } from '../../../shared/model/domain/server-identity.model';

import { OIBusTestingError, OIBusValidationError } from '../../model/types';
import type CertificateService from '../../service/certificate.service';
import type OIAnalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import testData from '../../tests/utils/test-data';
import { createMock, createMockServices, fixTsoaModuleResolution, Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import { CustomExpressRequest } from '../express';
import type { OIAnalyticsRegistrationController as OIAnalyticsRegistrationControllerShape } from './oianalytics-registration.controller';

const nodeRequire = createRequire(import.meta.url);

let mockRegistrationServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let OIAnalyticsRegistrationController: typeof OIAnalyticsRegistrationControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockRegistrationServiceModule = {
    toOIAnalyticsRegistrationDTO: mock.fn((settings: unknown, getUserInfo: (id: string) => unknown) => {
      getUserInfo('');
      return settings;
    })
  };
  mockModule(nodeRequire, '../../service/oia/oianalytics-registration.service', mockRegistrationServiceModule);
  const mod = reloadModule<{ OIAnalyticsRegistrationController: typeof OIAnalyticsRegistrationControllerShape }>(
    nodeRequire,
    './oianalytics-registration.controller'
  );
  OIAnalyticsRegistrationController = mod.OIAnalyticsRegistrationController;
});

describe('OIAnalyticsRegistrationController', () => {
  let controller: OIAnalyticsRegistrationControllerShape;
  let registrationService: Mocked<OIAnalyticsRegistrationService>;
  let certificateService: Mocked<CertificateService>;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    registrationService = createMock<OIAnalyticsRegistrationService>();
    certificateService = createMock<CertificateService>({
      trustServerCertificate: () => ({ id: 'trustedCertificateId' }),
      // saves with a trust adding the certificates as `trustServerCertificate` does
      saveTrustingServerCertificates: async (trustedBy, trustAndSave) =>
        trustAndSave((certificatePem, name) => certificateService.trustServerCertificate(certificatePem, name, trustedBy))
    });
    mockRequest = {
      user: { id: testData.users.list[0].id, login: testData.users.list[0].login },
      services: createMockServices({ oIAnalyticsRegistrationService: registrationService, certificateService })
    } as Partial<CustomExpressRequest>;
    mockRegistrationServiceModule.toOIAnalyticsRegistrationDTO = mock.fn((settings: unknown, getUserInfo: (id: string) => unknown) => {
      getUserInfo('');
      return settings;
    });
    controller = new OIAnalyticsRegistrationController();
  });

  it('should return registration settings', async () => {
    const mockSettings = testData.oIAnalytics.registration.completed;
    registrationService.getRegistrationSettings.mock.mockImplementation(() => mockSettings);

    const result = await controller.getRegistrationSettings(mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.getRegistrationSettings.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockSettings);
  });

  it('should register with OIAnalytics service', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    registrationService.register.mock.mockImplementation(async () => undefined);

    await controller.register(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.register.mock.calls.length, 1);
    const [registered, user, trustCertificate] = registrationService.register.mock.calls[0].arguments;
    assert.deepStrictEqual([registered, user], [command, testData.users.list[0].id]);
    assert.deepStrictEqual(trustCertificate('pem'), { id: 'trustedCertificateId' });
    assert.deepStrictEqual(certificateService.trustServerCertificate.mock.calls[0].arguments, [
      'pem',
      'OIAnalytics server',
      testData.users.list[0].id
    ]);
  });

  it('should update registration settings', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    registrationService.editRegistrationSettings.mock.mockImplementation(async () => undefined);

    await controller.editRegistrationSettings(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.editRegistrationSettings.mock.calls.length, 1);
    const [edited, user, trustCertificate] = registrationService.editRegistrationSettings.mock.calls[0].arguments;
    assert.deepStrictEqual([edited, user], [command, testData.users.list[0].id]);
    assert.deepStrictEqual(trustCertificate!('pem'), { id: 'trustedCertificateId' });
  });

  it('should unregister from OIAnalytics service', async () => {
    registrationService.unregister.mock.mockImplementation(async () => undefined);

    await controller.unregister(mockRequest as CustomExpressRequest);

    assert.strictEqual(registrationService.unregister.mock.calls.length, 1);
  });

  it('should test connection', async () => {
    const command: RegistrationSettingsCommandDTO = testData.oIAnalytics.registration.command;
    registrationService.testConnection.mock.mockImplementation(async () => ({ items: [] }));

    assert.deepStrictEqual(await controller.testConnection(command, mockRequest as CustomExpressRequest), { items: [] });
    await controller.testConnection(command, mockRequest as CustomExpressRequest, true);

    assert.deepStrictEqual(registrationService.testConnection.mock.calls[0].arguments, [command, false]);
    assert.deepStrictEqual(registrationService.testConnection.mock.calls[1].arguments, [command, true]);
  });

  describe('identity of OIAnalytics', () => {
    const identity: ServerIdentity = { type: 'x509', fingerprint: 'AB:CD', details: { keyType: 'rsa' } };

    it('should give the trust of the registration in the identity of OIAnalytics', () => {
      registrationService.getServerTrustState.mock.mockImplementation(() => ({
        identity: null,
        trustOnFirstUse: false,
        pending: { identity, status: 'unknown' }
      }));

      assert.deepStrictEqual(controller.getServerTrust(mockRequest as CustomExpressRequest), {
        identity: null,
        trustOnFirstUse: false,
        pending: { identity, status: 'unknown' }
      });
    });

    it('should trust the identity of OIAnalytics', async () => {
      await controller.trustServerIdentity({ fingerprint: 'AB:CD' }, mockRequest as CustomExpressRequest);

      const [fingerprint, user, trustCertificate] = registrationService.trustServerIdentity.mock.calls[0].arguments;
      assert.deepStrictEqual([fingerprint, user], ['AB:CD', testData.users.list[0].id]);
      assert.deepStrictEqual(trustCertificate('pem'), { id: 'trustedCertificateId' });
    });

    it('should report the errors of trusting the identity of OIAnalytics', async () => {
      registrationService.trustServerIdentity.mock.mockImplementation(async () => {
        throw new OIBusValidationError('not the one to trust');
      });
      await assert.rejects(
        controller.trustServerIdentity({ fingerprint: 'AB:CD' }, mockRequest as CustomExpressRequest),
        OIBusValidationError
      );

      registrationService.trustServerIdentity.mock.mockImplementation(async () => {
        throw new Error('connection refused');
      });
      await assert.rejects(
        controller.trustServerIdentity({ fingerprint: 'AB:CD' }, mockRequest as CustomExpressRequest),
        new OIBusTestingError('connection refused')
      );
    });

    it('should retrieve the identity OIAnalytics presents', async () => {
      registrationService.retrieveServerIdentity.mock.mockImplementation(async () => ({ identity, status: 'trusted' }));
      assert.deepStrictEqual(await controller.retrieveServerIdentity(mockRequest as CustomExpressRequest), {
        identity,
        status: 'trusted'
      });

      registrationService.retrieveServerIdentity.mock.mockImplementation(async () => {
        throw new Error('connection refused');
      });
      await assert.rejects(
        controller.retrieveServerIdentity(mockRequest as CustomExpressRequest),
        new OIBusTestingError('connection refused')
      );
    });
  });
});
