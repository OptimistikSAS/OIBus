import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CertificateCommandDTO } from '../../../shared/model/certificate.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import CertificateServiceMock from '../../tests/__mocks__/service/certificate-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import type { CertificateController as CertificateControllerShape } from './certificate.controller';

const nodeRequire = createRequire(import.meta.url);

let mockCertServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let CertificateController: typeof CertificateControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockCertServiceModule = {
    toCertificateDTO: mock.fn((cert: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return cert;
    })
  };
  mockModule(nodeRequire, '../../service/certificate.service', mockCertServiceModule);
  const mod = reloadModule<{ CertificateController: typeof CertificateControllerShape }>(nodeRequire, './certificate.controller');
  CertificateController = mod.CertificateController;
});

describe('CertificateController', () => {
  let controller: CertificateControllerShape;
  let certificateService: CertificateServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    certificateService = new CertificateServiceMock();
    userService = new UserServiceMock();
    mockRequest = {
      services: { certificateService, userService },
      user: { id: 'test', login: 'testUser' }
    } as Partial<CustomExpressRequest>;
    mockCertServiceModule.toCertificateDTO = mock.fn((cert: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return cert;
    });
    controller = new CertificateController();
  });

  it('should return a list of certificates', async () => {
    const mockCertificates = testData.certificates.list;
    certificateService.list = mock.fn(() => mockCertificates);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockCertificates);
  });

  it('should return a certificate by ID', async () => {
    const mockCertificate = testData.certificates.list[0];
    const certificateId = 'test-id';
    certificateService.findById = mock.fn(() => mockCertificate);

    const result = await controller.findById(certificateId, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.findById.mock.calls[0].arguments[0], certificateId);
    assert.deepStrictEqual(result, mockCertificate);
  });

  it('should create a new certificate', async () => {
    const command: CertificateCommandDTO = testData.certificates.command;
    const createdCertificate = testData.certificates.list[0];
    certificateService.create = mock.fn(async () => createdCertificate);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.create.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.create.mock.calls[0].arguments, [command, 'test']);
    assert.deepStrictEqual(result, createdCertificate);
  });

  it('should update an existing certificate', async () => {
    const certificateId = 'test-id';
    const command: CertificateCommandDTO = testData.certificates.command;
    certificateService.update = mock.fn(async () => undefined);

    await controller.update(certificateId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.update.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.update.mock.calls[0].arguments, [certificateId, command, 'test']);
  });

  it('should delete a certificate', async () => {
    const certificateId = 'test-id';
    certificateService.delete = mock.fn(async () => undefined);

    await controller.delete(certificateId, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.delete.mock.calls[0].arguments[0], certificateId);
  });
});
