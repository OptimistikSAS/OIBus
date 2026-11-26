import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import * as forge from 'node-forge';

import { CertificateCommandDTO } from '../../shared/model/api/certificate.model';

import type { CertificateImportCommand } from '../model/certificate.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
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
import { encryptionService } from './encryption.service';
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

/** An EC certificate of a certification authority (CA:TRUE), valid until 2126: the certificates OIBus trusts may not be RSA */
const EC_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIBmTCCAT+gAwIBAgIUD3pRmb8+yx3pRHal3wu7tO38aDEwCgYIKoZIzj0EAwIw
ITEfMB0GA1UEAwwWT0lCdXMgdGVzdCBpbnRlcm5hbCBDQTAgFw0yNjExMjYyMjAw
NTFaGA8yMTI2MTEwMjIyMDA1MVowITEfMB0GA1UEAwwWT0lCdXMgdGVzdCBpbnRl
cm5hbCBDQTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABNj2d8+b3cSGEiHJ7TTh
JaSw/ja9Je8VClY/fSNZfMdj+krB6W7YMx6LuRLv7+xKB9yK4821yvOrwBKqSpwC
mIujUzBRMB0GA1UdDgQWBBR8ereQLC5aOt1HXp0rcmmZjDRi4jAfBgNVHSMEGDAW
gBR8ereQLC5aOt1HXp0rcmmZjDRi4jAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49
BAMCA0gAMEUCIQCqtFcCQG03F/eVuxoZjAHvqfMGXc0AzUM85eVUoMjVSAIgXZuV
m/Z0ClXZGLQnZFMl85Um7U4fEfBsTSrMxGSIe2M=
-----END CERTIFICATE-----
`;
const EC_CA_FINGERPRINT = 'DD:2D:19:AD:56:3D:B4:7E:87:00:FF:EE:EF:A7:99:FA:4C:DC:B6:EC:99:81:A8:BA:77:56:C5:C4:2A:68:46:73';

describe('Certificate Service', () => {
  let decryptTextMock: Mock<(text: string) => string>;
  let validator: Mocked<JoiValidator>;
  let certificateRepository: Mocked<CertificateRepository>;
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
    certificateRepository = createMock<CertificateRepository>({ findUsages: () => [] });
    mock.method(encryptionService, 'generateSelfSignedCertificate', async () => ({ public: 'public', private: 'private', cert: certPem }));
    mock.method(encryptionService, 'encryptText', (text: string) => text);
    decryptTextMock = mock.method(encryptionService, 'decryptText', (text: string) => text);
    oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    logger = new LoggerMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new CertificateService(validator, certificateRepository, oIAnalyticsMessageService, logger);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should give a certificate with its private key decrypted', () => {
    certificateRepository.findById.mock.mockImplementation(() => ({
      ...testData.certificates.list[0],
      certificateChain: 'chain',
      privateKey: 'encrypted private key'
    }));

    assert.deepStrictEqual(service.getKeyPair(testData.certificates.list[0].id), {
      name: testData.certificates.list[0].name,
      certificate: testData.certificates.list[0].certificate,
      certificateChain: 'chain',
      privateKey: 'encrypted private key'
    });
    // decrypted by the encryption service
    assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted private key']);
  });

  it('should not give a certificate which does not exist', () => {
    certificateRepository.findById.mock.mockImplementation(() => null);

    assert.throws(() => service.getKeyPair('unknown'), new NotFoundError('Certificate "unknown" not found'));
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

  it('should create a self-signed certificate without validating its options', async () => {
    certificateRepository.create.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    const options = { ...testData.certificates.command.options!, countryName: '', organizationName: '' };

    const result = await service.createSelfSigned('name', 'description', options, 'system');

    assert.strictEqual(validator.validate.mock.calls.length, 0);
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.name, 'name');
    assert.strictEqual(createArgs.description, 'description');
    assert.strictEqual(createArgs.certificate, certPem);
    assert.strictEqual(createArgs.createdBy, 'system');
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
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

  it('should not delete a certificate in use', () => {
    certificateRepository.findById.mock.mockImplementation(() => testData.certificates.list[0]);
    certificateRepository.findUsages.mock.mockImplementation(() => [
      { type: 'south', name: 'OPC UA' },
      { type: 'web-server', name: 'OIBus' }
    ]);

    assert.throws(
      () => service.delete(testData.certificates.list[0].id, 'userTest'),
      new OIBusValidationError(
        `Certificate "${testData.certificates.list[0].name}" is used by the South connector "OPC UA", the web server (HTTPS): ` +
          'select another certificate there before deleting it'
      )
    );
    assert.strictEqual(certificateRepository.delete.mock.callCount(), 0);
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

  it('should import a trusted certificate without private key, of any key algorithm', async () => {
    certificateRepository.create.mock.mockImplementationOnce(() => testData.certificates.list[0]);

    await service.import(importCommand({ certificateContent: Buffer.from(EC_CA_PEM), privateKeyContent: null }), 'userTest');

    const createArgs = certificateRepository.create.mock.calls[0].arguments[0];
    assert.strictEqual(createArgs.kind, 'trusted');
    assert.strictEqual(createArgs.privateKey, '');
    assert.strictEqual(createArgs.certificate, EC_CA_PEM);
    assert.strictEqual(createArgs.certificateChain, null);
    assert.strictEqual(createArgs.expiry, '2126-11-02T22:00:51.000Z');
    assert.match(createArgs.publicKey, /^-----BEGIN PUBLIC KEY-----/);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should import a certificate with its private key as presented by OIBus', async () => {
    certificateRepository.create.mock.mockImplementationOnce(() => testData.certificates.list[0]);

    await service.import(importCommand(), 'userTest');

    assert.strictEqual(certificateRepository.create.mock.calls[0].arguments[0].kind, 'key-pair');
  });

  it('should not import a trusted certificate with a chain', async () => {
    await assert.rejects(
      service.import(importCommand({ privateKeyContent: null, certificateChainContent: Buffer.from(certificateChainPem) }), 'userTest'),
      { message: 'A trusted certificate is imported without chain: import each certificate to trust' }
    );
    assert.strictEqual(certificateRepository.create.mock.calls.length, 0);
  });

  it('should not present, regenerate or export the private key of a trusted certificate, which has none', async () => {
    const trusted = { ...testData.certificates.list[0], kind: 'trusted' as const, privateKey: '' };
    certificateRepository.findById.mock.mockImplementation(() => trusted);
    const refused = (operation: string) => ({
      message: `Certificate "${trusted.name}" is a trusted certificate, without private key: cannot ${operation}`
    });

    assert.throws(() => service.getKeyPair(trusted.id), refused('present it'));
    await assert.rejects(
      service.update(trusted.id, { name: 'name', description: '', regenerateCertificate: true, options: null }, 'userTest'),
      refused('regenerate it')
    );
    await assert.rejects(service.exportPrivateKey(trusted.id, 'passphrase', 'userTest'), refused('export its private key'));
    assert.strictEqual(certificateRepository.update.mock.calls.length, 0);
  });

  it('should tell whether a certificate is a certification authority, with its fingerprint', () => {
    const dto = toCertificateDTO({ ...testData.certificates.list[0], kind: 'trusted', certificate: EC_CA_PEM }, id => ({
      id,
      friendlyName: id
    }));

    assert.strictEqual(dto.kind, 'trusted');
    assert.strictEqual(dto.certificationAuthority, true);
    assert.strictEqual(dto.fingerprint, EC_CA_FINGERPRINT);
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
      kind: 'key-pair',
      // not a parsable certificate in the test data
      certificationAuthority: false,
      fingerprint: '',
      createdBy: getUserInfo(certificate.createdBy),
      updatedBy: getUserInfo(certificate.updatedBy),
      createdAt: certificate.createdAt,
      updatedAt: certificate.updatedAt
    });
  });
});
