import { beforeEach, afterEach, describe, it, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import * as forge from 'node-forge';
import testData from '../tests/utils/test-data';
import {
  certificateSchema,
  certificateImportSchema,
  certificatePrivateKeyExportSchema
} from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateService, { toCertificateDTO } from './certificate.service';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { certificateContentToPem, certificatePemToDer, readCertificate, splitPemChain } from './utils-certificate';
import { CertificateImportCommand } from '../model/certificate.model';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';

let validator: { validate: ReturnType<typeof mock.fn> };
let certificateRepository: CertificateRepositoryMock;
let encryptionService: EncryptionServiceMock;
let oIAnalyticsMessageService: OianalyticsMessageServiceMock;
let logger: LoggerMock;
let service: CertificateService;
let certPem: string;
let privateKeyPem: string;
let certificateChainPem: string;

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
  before(() => {
    const generated = generateSelfSignedCertificate('oibus-test');
    certPem = generated.pem;
    privateKeyPem = generated.privateKeyPem;
    certificateChainPem = generateSelfSignedCertificate('oibus-ca').pem;
  });

  beforeEach(() => {
    validator = { validate: mock.fn() };
    certificateRepository = new CertificateRepositoryMock();
    encryptionService = new EncryptionServiceMock('', '');
    oIAnalyticsMessageService = new OianalyticsMessageServiceMock();
    logger = new LoggerMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new CertificateService(
      validator as unknown as JoiValidator,
      certificateRepository as unknown as CertificateRepository,
      encryptionService as unknown as EncryptionService,
      oIAnalyticsMessageService as unknown as OIAnalyticsMessageService,
      logger
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should list all certificated', () => {
    certificateRepository.list.mock.mockImplementationOnce(() => testData.certificates.list);

    const result = service.list();

    assert.ok(certificateRepository.list.mock.calls.length > 0);
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
    encryptionService.generateSelfSignedCertificate.mock.mockImplementationOnce(async () => ({
      public: 'public',
      private: 'private',
      cert: certPem
    }));

    const result = await service.create(testData.certificates.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [certificateSchema, testData.certificates.command]);
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0] as Record<string, unknown>;
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
    encryptionService.generateSelfSignedCertificate.mock.mockImplementationOnce(async () => ({
      public: 'public',
      private: 'private',
      cert: certPem
    }));
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
    const command: CertificateImportCommand = {
      name: 'Imported certificate',
      description: 'An imported certificate',
      certificateContent: Buffer.from(certPem),
      privateKeyContent: Buffer.from(privateKeyPem),
      privateKeyPassphrase: null,
      certificateChainContent: null
    };

    const result = await service.import(command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [
      certificateImportSchema,
      { name: command.name, description: command.description }
    ]);
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0] as Record<string, unknown>;
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
    const command: CertificateImportCommand = {
      name: 'Imported certificate',
      description: 'An imported certificate',
      certificateContent: Buffer.from(certPem),
      privateKeyContent: Buffer.from(privateKeyPem),
      privateKeyPassphrase: null,
      certificateChainContent: Buffer.from(certificateChainPem)
    };

    await service.import(command, 'userTest');

    const expectedChain = splitPemChain(certificateContentToPem(Buffer.from(certificateChainPem))).join('\n');
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0] as Record<string, unknown>;
    assert.strictEqual(createArgs.certificateChain, expectedChain);
  });

  it('should reject an import when the private key does not match the certificate', async () => {
    const otherKeyPem = generateSelfSignedCertificate('other').privateKeyPem;
    const command: CertificateImportCommand = {
      name: 'Imported certificate',
      description: 'An imported certificate',
      certificateContent: Buffer.from(certPem),
      privateKeyContent: Buffer.from(otherKeyPem),
      privateKeyPassphrase: null,
      certificateChainContent: null
    };

    await assert.rejects(service.import(command, 'userTest'), {
      message: 'The private key does not match the certificate public key'
    });
  });

  it('should export a certificate in PEM format without the CA chain', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => ({
      ...testData.certificates.list[0],
      certificate: certPem,
      certificateChain: certificateChainPem
    }));

    const result = service.exportCertificate(testData.certificates.list[0].id, 'PEM', false);

    assert.strictEqual(result.extension, 'pem');
    assert.strictEqual(result.content, certPem);
  });

  it('should export a certificate in PEM format including the CA chain', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => ({
      ...testData.certificates.list[0],
      certificate: certPem,
      certificateChain: certificateChainPem
    }));

    const result = service.exportCertificate(testData.certificates.list[0].id, 'PEM', true);

    assert.strictEqual(result.content, [certPem, certificateChainPem].join(''));
  });

  it('should export a certificate in DER format', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => ({
      ...testData.certificates.list[0],
      certificate: certPem,
      certificateChain: null
    }));

    const result = service.exportCertificate(testData.certificates.list[0].id, 'DER', false);

    assert.strictEqual(result.extension, 'cer');
    assert.deepStrictEqual(result.content, certificatePemToDer(certPem));
  });

  it('should reject exporting the CA chain in DER format', () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => ({
      ...testData.certificates.list[0],
      certificate: certPem,
      certificateChain: certificateChainPem
    }));

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
