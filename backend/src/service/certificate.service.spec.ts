import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import * as forge from 'node-forge';

import { CertificateCommandDTO } from '../../shared/model/api/certificate.model';

import type { CertificateImportCommand } from '../model/certificate.model';
import type CertificateRepository from '../repository/config/certificate.repository';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked } from '../tests/utils/test-utils';
import type JoiValidator from '../web-server/controllers/validators/joi.validator';
import {
  certificateImportSchema,
  certificatePrivateKeyExportSchema,
  certificateSchema
} from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateService, { toCertificateDTO } from './certificate.service';
import type EncryptionService from './encryption.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { certificateContentToPem, certificatePemToDer, readCertificate, splitPemChain } from './utils-certificate';

const generateSelfSignedCertificate = (commonName: string): { pem: string; privateKeyPem: string } => {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(19));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ shortName: 'CN', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return { pem: forge.pki.certificateToPem(cert), privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey) };
};

describe('Certificate Service', () => {
  let validator: Mocked<JoiValidator>;
  let certificateRepository: Mocked<CertificateRepository>;
  let encryptionService: Mocked<EncryptionService>;
  let oIAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
  let logger: LoggerMock;
  let service: CertificateService;
  let certPem: string;
  let privateKeyPem: string;
  let certificateChainPem: string;

  const importCommand = (overrides: Partial<CertificateImportCommand> = {}): CertificateImportCommand => ({
    name: 'Imported certificate',
    description: 'An imported certificate',
    certificateContent: Buffer.from(certPem),
    privateKeyContent: Buffer.from(privateKeyPem),
    privateKeyPassphrase: null,
    certificateChainContent: null,
    ...overrides
  });

  const storedCertificate = (certificateChain: string | null) => ({
    ...testData.certificates.list[0],
    certificate: certPem,
    certificateChain
  });

  before(() => {
    const generated = generateSelfSignedCertificate('oibus-test');
    certPem = generated.pem;
    privateKeyPem = generated.privateKeyPem;
    certificateChainPem = generateSelfSignedCertificate('oibus-ca').pem;
  });

  beforeEach(() => {
    validator = createMock<JoiValidator>();
    certificateRepository = createMock<CertificateRepository>();
    encryptionService = createMock<EncryptionService>({
      generateSelfSignedCertificate: async () => ({ public: 'public', private: 'private', cert: certPem }),
      encryptText: async text => text,
      decryptText: async text => text
    });
    oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    logger = new LoggerMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new CertificateService(validator, certificateRepository, encryptionService, oIAnalyticsMessageService, logger);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should list all certificated', () => {
    certificateRepository.list.mock.mockImplementationOnce(() => testData.certificates.list);

    const result = service.list();

    assert.strictEqual(certificateRepository.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, testData.certificates.list);
  });

  it('should find a certificate by id', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);

    const result = service.findById(testData.certificates.list[0].id);

    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [testData.certificates.list[0].id]);
    assert.deepStrictEqual(result, testData.certificates.list[0]);
  });

  it('should not get if the certificate is not found', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.findById(testData.certificates.list[0].id), {
      message: `Certificate "${testData.certificates.list[0].id}" not found`
    });

    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [testData.certificates.list[0].id]);
    assert.strictEqual(certificateRepository.update.mock.calls.length, 0);
  });

  it('should create a certificate', async () => {
    certificateRepository.create.mock.mockImplementationOnce(() => testData.certificates.list[0]);

    const result = await service.create(testData.certificates.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [certificateSchema, testData.certificates.command]);
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0];
    assert.ok(createArgs.id);
    assert.strictEqual(createArgs.name, testData.certificates.command.name);
    assert.strictEqual(createArgs.description, testData.certificates.command.description);
    assert.strictEqual(createArgs.publicKey, 'public');
    assert.strictEqual(createArgs.privateKey, 'private');
    assert.strictEqual(createArgs.certificate, certPem);
    assert.strictEqual(createArgs.certificateChain, null);
    assert.strictEqual(createArgs.expiry, readCertificate(certPem).expiry);
    assert.strictEqual(createArgs.createdBy, 'userTest');
    assert.strictEqual(createArgs.updatedBy, 'userTest');
    assert.deepStrictEqual(result, testData.certificates.list[0]);
  });

  it('should update a certificate', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.regenerateCertificate = true;

    await service.update(testData.certificates.list[0].id, command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [certificateSchema, command]);
    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [testData.certificates.list[0].id]);
    assert.deepStrictEqual(certificateRepository.update.mock.calls[0].arguments, [
      {
        id: testData.certificates.list[0].id,
        name: command.name,
        description: command.description,
        publicKey: 'public',
        privateKey: 'private',
        certificate: certPem,
        certificateChain: null,
        expiry: readCertificate(certPem).expiry,
        updatedBy: 'userTest'
      }
    ]);
  });

  it('should just update name and description if regenerateCertificate is false', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);

    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.regenerateCertificate = false;
    await service.update(testData.certificates.list[0].id, command, 'userTest');
    assert.deepStrictEqual(certificateRepository.updateNameAndDescription.mock.calls[0].arguments, [
      testData.certificates.list[0].id,
      command.name,
      command.description,
      'userTest'
    ]);
  });

  it('should delete a certificate', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);

    await service.delete(testData.certificates.list[0].id, 'userTest');

    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [testData.certificates.list[0].id]);
    assert.deepStrictEqual(certificateRepository.delete.mock.calls[0].arguments, [testData.certificates.list[0].id, 'userTest']);
  });

  it('should import a certificate without a CA chain', async () => {
    certificateRepository.create.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    const command = importCommand();

    const result = await service.import(command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [
      certificateImportSchema,
      { name: command.name, description: command.description }
    ]);
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0];
    assert.ok(createArgs.id);
    assert.strictEqual(createArgs.name, command.name);
    assert.strictEqual(createArgs.description, command.description);
    assert.strictEqual(createArgs.publicKey, readCertificate(certPem).publicKeyPem);
    assert.strictEqual(createArgs.privateKey, privateKeyPem);
    assert.strictEqual(createArgs.certificate, readCertificate(certPem).pem);
    assert.strictEqual(createArgs.certificateChain, null);
    assert.strictEqual(createArgs.expiry, readCertificate(certPem).expiry);
    assert.strictEqual(createArgs.createdBy, 'userTest');
    assert.strictEqual(createArgs.updatedBy, 'userTest');
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(result, testData.certificates.list[0]);
  });

  it('should import a certificate with a CA chain', async () => {
    certificateRepository.create.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    await service.import(importCommand({ certificateChainContent: Buffer.from(certificateChainPem) }), 'userTest');

    const expectedChain = splitPemChain(certificateContentToPem(Buffer.from(certificateChainPem))).join('\n');
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.certificateChain, expectedChain);
  });

  it('should reject an import when the private key does not match the certificate', async () => {
    const otherKeyPem = generateSelfSignedCertificate('other').privateKeyPem;

    await assert.rejects(service.import(importCommand({ privateKeyContent: Buffer.from(otherKeyPem) }), 'userTest'), {
      message: 'The private key does not match the certificate public key'
    });
  });

  it('should export a certificate in PEM format without the CA chain', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => storedCertificate(certificateChainPem));

    const result = service.exportCertificate(testData.certificates.list[0].id, 'PEM', false);

    assert.strictEqual(result.extension, 'pem');
    assert.strictEqual(result.content, certPem);
  });

  it('should export a certificate in PEM format including the CA chain', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => storedCertificate(certificateChainPem));

    const result = service.exportCertificate(testData.certificates.list[0].id, 'PEM', true);

    assert.strictEqual(result.content, [certPem, certificateChainPem].join(''));
  });

  it('should export a certificate in DER format', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => storedCertificate(null));

    const result = service.exportCertificate(testData.certificates.list[0].id, 'DER', false);

    assert.strictEqual(result.extension, 'cer');
    assert.deepStrictEqual(result.content, certificatePemToDer(certPem));
  });

  it('should reject exporting the CA chain in DER format', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => storedCertificate(certificateChainPem));

    assert.throws(() => service.exportCertificate(testData.certificates.list[0].id, 'DER', true), {
      message: 'The CA chain cannot be exported in DER format'
    });
  });

  it('should not export a certificate that does not exist', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.exportCertificate(testData.certificates.list[0].id, 'PEM', false), {
      message: `Certificate "${testData.certificates.list[0].id}" not found`
    });
  });

  it('should export the private key of a certificate', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => ({
      ...testData.certificates.list[0],
      name: 'my certificate',
      privateKey: privateKeyPem
    }));

    const result = await service.exportPrivateKey(testData.certificates.list[0].id, 'a-strong-passphrase', 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [
      certificatePrivateKeyExportSchema,
      { passphrase: 'a-strong-passphrase' }
    ]);
    assert.ok(result.includes('ENCRYPTED PRIVATE KEY'));
    assert.strictEqual(logger.info.mock.calls.length, 1);
    assert.match(logger.info.mock.calls[0].arguments[0] as string, /my certificate/);
    assert.match(logger.info.mock.calls[0].arguments[0] as string, /userTest/);
  });

  it('should not export the private key of a certificate that does not exist', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(service.exportPrivateKey(testData.certificates.list[0].id, 'a-strong-passphrase', 'userTest'), {
      message: `Certificate "${testData.certificates.list[0].id}" not found`
    });
  });

  it('should properly convert to DTO', () => {
    const certificate = testData.certificates.list[0];
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    assert.deepStrictEqual(toCertificateDTO(certificate, getUserInfo), {
      id: certificate.id,
      name: certificate.name,
      description: certificate.description,
      publicKey: certificate.publicKey,
      certificate: certificate.certificate,
      certificateChain: certificate.certificateChain,
      expiry: certificate.expiry,
      createdBy: getUserInfo(certificate.createdBy),
      updatedBy: getUserInfo(certificate.updatedBy),
      createdAt: certificate.createdAt,
      updatedAt: certificate.updatedAt
    });
  });
});
