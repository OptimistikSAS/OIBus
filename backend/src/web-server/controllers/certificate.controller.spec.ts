import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type express from 'express';

import { CertificateCommandDTO, CertificatePrivateKeyExportCommandDTO } from '../../../shared/model/api/certificate.model';

import type CertificateService from '../../service/certificate.service';
import type UserService from '../../service/user.service';
import testData from '../../tests/utils/test-data';
import { createMock, createMockServices, fixTsoaModuleResolution, Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import { CustomExpressRequest } from '../express';
import type { CertificateController as CertificateControllerShape } from './certificate.controller';

const nodeRequire = createRequire(import.meta.url);

// The DTO mapper returns the entity as is, after asking for the user info like the real one
const createCertificateServiceModuleMocks = () => ({
  toCertificateDTO: mock.fn((cert: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return cert;
  })
});
// Same object for the whole file (the controller keeps it): its functions are replaced in beforeEach
const certificateServiceModule = createCertificateServiceModuleMocks();
let CertificateController: typeof CertificateControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockModule(nodeRequire, '../../service/certificate.service', certificateServiceModule);
  const mod = reloadModule<{ CertificateController: typeof CertificateControllerShape }>(nodeRequire, './certificate.controller');
  CertificateController = mod.CertificateController;
});

const certificateFile = { path: 'certPath' } as Express.Multer.File;
const privateKeyFile = { path: 'keyPath' } as Express.Multer.File;
const certificateChainFile = { path: 'chainPath' } as Express.Multer.File;

describe('CertificateController', () => {
  let controller: CertificateControllerShape;
  let certificateService: Mocked<CertificateService>;
  let userService: Mocked<UserService>;
  let mockRequest: Partial<CustomExpressRequest>;
  let mockRes: Mocked<express.Response>;

  beforeEach(() => {
    certificateService = createMock<CertificateService>();
    userService = createMock<UserService>();
    mockRes = createMock<express.Response>();
    mockRes.status.mock.mockImplementation(() => mockRes);
    mockRequest = {
      services: createMockServices({ certificateService, userService }),
      user: { id: 'test', login: 'testUser' },
      res: mockRes
    };
    Object.assign(certificateServiceModule, createCertificateServiceModuleMocks());
    controller = new CertificateController();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return a list of certificates', async () => {
    const mockCertificates = testData.certificates.list;
    certificateService.list.mock.mockImplementation(() => mockCertificates);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockCertificates);
  });

  it('should return a certificate by ID', async () => {
    const mockCertificate = testData.certificates.list[0];
    const certificateId = 'test-id';
    certificateService.findById.mock.mockImplementation(() => mockCertificate);

    const result = await controller.findById(certificateId, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.findById.mock.calls[0].arguments[0], certificateId);
    assert.deepStrictEqual(result, mockCertificate);
  });

  it('should create a new certificate', async () => {
    const command: CertificateCommandDTO = testData.certificates.command;
    const createdCertificate = testData.certificates.list[0];
    certificateService.create.mock.mockImplementation(async () => createdCertificate);

    const result = await controller.create(command, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.create.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.create.mock.calls[0].arguments, [command, 'test']);
    assert.deepStrictEqual(result, createdCertificate);
  });

  it('should update an existing certificate', async () => {
    const certificateId = 'test-id';
    const command: CertificateCommandDTO = testData.certificates.command;
    certificateService.update.mock.mockImplementation(async () => undefined);

    await controller.update(certificateId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.update.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.update.mock.calls[0].arguments, [certificateId, command, 'test']);
  });

  it('should delete a certificate', async () => {
    const certificateId = 'test-id';
    certificateService.delete.mock.mockImplementation(async () => undefined);

    await controller.delete(certificateId, mockRequest as CustomExpressRequest);

    assert.strictEqual(certificateService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.delete.mock.calls[0].arguments, [certificateId, 'test']);
  });

  it('should import a certificate', async () => {
    const importedCertificate = testData.certificates.list[0];
    certificateService.import.mock.mockImplementation(async () => importedCertificate);
    const readFileMock = mock.method(fs, 'readFile', async (path: string) => Buffer.from(`content-of-${path}`));
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    const result = await controller.import(
      'my cert',
      'my description',
      'passphrase',
      certificateFile,
      privateKeyFile,
      certificateChainFile,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(readFileMock.mock.calls.length, 3);
    assert.strictEqual(certificateService.import.mock.calls.length, 1);
    assert.deepStrictEqual(certificateService.import.mock.calls[0].arguments, [
      {
        name: 'my cert',
        description: 'my description',
        certificateContent: Buffer.from('content-of-certPath'),
        privateKeyContent: Buffer.from('content-of-keyPath'),
        privateKeyPassphrase: 'passphrase',
        certificateChainContent: Buffer.from('content-of-chainPath')
      },
      'test'
    ]);
    assert.strictEqual(unlinkMock.mock.calls.length, 3);
    assert.deepStrictEqual(result, importedCertificate);
  });

  it('should import a certificate without a CA chain and default the passphrase to null', async () => {
    certificateService.import.mock.mockImplementation(async () => testData.certificates.list[0]);
    mock.method(fs, 'readFile', async (path: string) => Buffer.from(`content-of-${path}`));
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    await controller.import(
      'my cert',
      'my description',
      undefined,
      certificateFile,
      privateKeyFile,
      undefined,
      mockRequest as CustomExpressRequest
    );

    assert.deepStrictEqual(certificateService.import.mock.calls[0].arguments[0], {
      name: 'my cert',
      description: 'my description',
      certificateContent: Buffer.from('content-of-certPath'),
      privateKeyContent: Buffer.from('content-of-keyPath'),
      privateKeyPassphrase: null,
      certificateChainContent: null
    });
    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should not import a certificate if the certificate file is missing', async () => {
    await assert.rejects(
      controller.import('my cert', 'my description', undefined, undefined!, privateKeyFile, undefined, mockRequest as CustomExpressRequest),
      { message: 'Missing file "certificate"' }
    );
  });

  it('should not import a certificate if the private key file is missing', async () => {
    await assert.rejects(
      controller.import(
        'my cert',
        'my description',
        undefined,
        certificateFile,
        undefined!,
        undefined,
        mockRequest as CustomExpressRequest
      ),
      { message: 'Missing file "privateKey"' }
    );
  });

  it('should unlink uploaded files even if the import fails', async () => {
    certificateService.import.mock.mockImplementation(async () => {
      throw new Error('import error');
    });
    mock.method(fs, 'readFile', async (path: string) => Buffer.from(`content-of-${path}`));
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    await assert.rejects(
      controller.import(
        'my cert',
        'my description',
        undefined,
        certificateFile,
        privateKeyFile,
        undefined,
        mockRequest as CustomExpressRequest
      ),
      { message: 'import error' }
    );

    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should swallow unlink errors for all uploaded files during cleanup', async () => {
    certificateService.import.mock.mockImplementation(async () => testData.certificates.list[0]);
    mock.method(fs, 'readFile', async (path: string) => Buffer.from(`content-of-${path}`));
    const unlinkMock = mock.method(fs, 'unlink', async () => {
      throw new Error('unlink failed');
    });

    const result = await controller.import(
      'my cert',
      'my description',
      'passphrase',
      certificateFile,
      privateKeyFile,
      certificateChainFile,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(unlinkMock.mock.calls.length, 3);
    assert.deepStrictEqual(result, testData.certificates.list[0]);
  });

  it('should export a certificate', () => {
    certificateService.findById.mock.mockImplementation(() => ({ ...testData.certificates.list[0], name: 'my certificate' }));
    certificateService.exportCertificate.mock.mockImplementation(() => ({
      extension: 'pem',
      content: 'pem-content'
    }));

    controller.exportCertificate('test-id', 'PEM', true, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(certificateService.exportCertificate.mock.calls[0].arguments, ['test-id', 'PEM', true]);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments, ['my-certificate.pem']);
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments, ['application/x-pem-file']);
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments, [200]);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments, ['pem-content']);
  });

  it('should export a certificate in DER format', () => {
    certificateService.findById.mock.mockImplementation(() => ({ ...testData.certificates.list[0], name: 'my certificate' }));
    certificateService.exportCertificate.mock.mockImplementation(() => ({
      extension: 'cer',
      content: Buffer.from('der-content')
    }));

    controller.exportCertificate('test-id', 'DER', false, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments, ['my-certificate.cer']);
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments, ['application/pkix-cert']);
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments, [200]);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments, [Buffer.from('der-content')]);
  });

  it('should export the private key of a certificate', async () => {
    const command: CertificatePrivateKeyExportCommandDTO = { passphrase: 'a-strong-passphrase' };
    certificateService.findById.mock.mockImplementation(() => ({ ...testData.certificates.list[0], name: 'my certificate' }));
    certificateService.exportPrivateKey.mock.mockImplementation(async () => 'encrypted-key-content');

    await controller.exportPrivateKey('test-id', command, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(certificateService.exportPrivateKey.mock.calls[0].arguments, ['test-id', 'a-strong-passphrase', 'test']);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments, ['my-certificate-private-key.pem']);
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments, ['application/x-pem-file']);
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments, [200]);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments, ['encrypted-key-content']);
  });
});
