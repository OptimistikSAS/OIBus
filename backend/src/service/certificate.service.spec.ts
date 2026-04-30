import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import testData from '../tests/utils/test-data';
import { certificateSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateService, { toCertificateDTO } from './certificate.service';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { DateTime, Duration } from 'luxon';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';

let validator: { validate: ReturnType<typeof mock.fn> };
let certificateRepository: CertificateRepositoryMock;
let encryptionService: EncryptionServiceMock;
let oIAnalyticsMessageService: OianalyticsMessageServiceMock;
let service: CertificateService;

describe('Certificate Service', () => {
  beforeEach(() => {
    validator = { validate: mock.fn() };
    certificateRepository = new CertificateRepositoryMock();
    encryptionService = new EncryptionServiceMock('', '');
    oIAnalyticsMessageService = new OianalyticsMessageServiceMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new CertificateService(
      validator as unknown as JoiValidator,
      certificateRepository as unknown as CertificateRepository,
      encryptionService as unknown as EncryptionService,
      oIAnalyticsMessageService as unknown as OIAnalyticsMessageService
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
      cert: 'cert'
    }));

    const result = await service.create(testData.certificates.command, 'userTest');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [certificateSchema, testData.certificates.command]);
    const createArgs = certificateRepository.create.mock.calls[0].arguments[0] as Record<string, unknown>;
    assert.ok(createArgs.id);
    assert.strictEqual(createArgs.name, testData.certificates.command.name);
    assert.strictEqual(createArgs.description, testData.certificates.command.description);
    assert.strictEqual(createArgs.publicKey, 'public');
    assert.strictEqual(createArgs.privateKey, 'private');
    assert.strictEqual(createArgs.certificate, 'cert');
    assert.strictEqual(
      createArgs.expiry,
      DateTime.now()
        .startOf('day')
        .plus(Duration.fromObject({ days: testData.certificates.command.options!.daysBeforeExpiry }))
        .toISO()!
    );
    assert.strictEqual(createArgs.createdBy, 'userTest');
    assert.strictEqual(createArgs.updatedBy, 'userTest');
    assert.deepStrictEqual(result, testData.certificates.list[0]);
  });

  it('should update a certificate', async () => {
    certificateRepository.findById.mock.mockImplementationOnce(() => testData.certificates.list[0]);
    encryptionService.generateSelfSignedCertificate.mock.mockImplementationOnce(async () => ({
      public: 'public',
      private: 'private',
      cert: 'cert'
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
        certificate: 'cert',
        expiry: DateTime.now()
          .startOf('day')
          .plus(Duration.fromObject({ days: command.options!.daysBeforeExpiry }))
          .toISO()!,
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

    await service.delete(testData.certificates.list[0].id);

    assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [testData.certificates.list[0].id]);
    assert.deepStrictEqual(certificateRepository.delete.mock.calls[0].arguments, [testData.certificates.list[0].id]);
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
      expiry: certificate.expiry,
      createdBy: getUserInfo(certificate.createdBy),
      updatedBy: getUserInfo(certificate.updatedBy),
      createdAt: certificate.createdAt,
      updatedAt: certificate.updatedAt
    });
  });
});
