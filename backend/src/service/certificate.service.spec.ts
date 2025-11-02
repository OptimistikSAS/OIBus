import JoiValidator from '../web-server/controllers/validators/joi.validator';
import testData from '../tests/utils/test-data';
import { certificateSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import CertificateService, { toCertificateDTO } from './certificate.service';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { generateRandomId } from './utils';
import { DateTime, Duration } from 'luxon';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import { NotFoundError } from '../model/types';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OianalyticsMessageServiceMock();

let service: CertificateService;
describe('Certificate Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new CertificateService(validator, certificateRepository, encryptionService, oIAnalyticsMessageService);
  });

  it('should list all certificated', () => {
    (certificateRepository.list as jest.Mock).mockReturnValueOnce(testData.certificates.list);

    const result = service.list();

    expect(certificateRepository.list).toHaveBeenCalled();
    expect(result).toEqual(testData.certificates.list.map(element => toCertificateDTO(element)));
  });

  it('should find a certificate by id', () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    const result = service.findById(testData.certificates.list[0].id);

    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(result).toEqual(toCertificateDTO(testData.certificates.list[0]));
  });

  it('should not get if the certificate is not found', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findById(testData.certificates.list[0].id)).toThrow(
      new NotFoundError(`Certificate "${testData.certificates.list[0].id}" not found`)
    );

    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(certificateRepository.update).not.toHaveBeenCalled();
  });

  it('should create a certificate', async () => {
    (certificateRepository.create as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);
    (generateRandomId as jest.Mock).mockReturnValueOnce('newCertificateId');
    (encryptionService.generateSelfSignedCertificate as jest.Mock).mockReturnValueOnce({
      public: 'public',
      private: 'private',
      cert: 'cert'
    });

    const result = await service.create(testData.certificates.command);

    expect(validator.validate).toHaveBeenCalledWith(certificateSchema, testData.certificates.command);
    expect(certificateRepository.create).toHaveBeenCalledWith({
      id: 'newCertificateId',
      name: testData.certificates.command.name,
      description: testData.certificates.command.description,
      publicKey: 'public',
      privateKey: 'private',
      certificate: 'cert',
      expiry: DateTime.now()
        .startOf('day')
        .plus(Duration.fromObject({ days: testData.certificates.command.options!.daysBeforeExpiry }))
        .toISO()!
    });
    expect(result).toEqual(toCertificateDTO(testData.certificates.list[0]));
  });

  it('should update a certificate', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);
    (encryptionService.generateSelfSignedCertificate as jest.Mock).mockReturnValueOnce({
      public: 'public',
      private: 'private',
      cert: 'cert'
    });
    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.regenerateCertificate = true;

    await service.update(testData.certificates.list[0].id, command);

    expect(validator.validate).toHaveBeenCalledWith(certificateSchema, command);
    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(certificateRepository.update).toHaveBeenCalledWith({
      id: testData.certificates.list[0].id,
      name: command.name,
      description: command.description,
      publicKey: 'public',
      privateKey: 'private',
      certificate: 'cert',
      expiry: DateTime.now()
        .startOf('day')
        .plus(Duration.fromObject({ days: command.options!.daysBeforeExpiry }))
        .toISO()!
    });
  });

  it('should just update name and description if regenerateCertificate is false', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.regenerateCertificate = false;
    await service.update(testData.certificates.list[0].id, command);
    expect(certificateRepository.updateNameAndDescription).toHaveBeenCalledWith(
      testData.certificates.list[0].id,
      command.name,
      command.description
    );
  });

  it('should delete a certificate', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    await service.delete(testData.certificates.list[0].id);

    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(certificateRepository.delete).toHaveBeenCalledWith(testData.certificates.list[0].id);
  });

  it('should properly convert to DTO', () => {
    const certificate = testData.certificates.list[0];
    expect(toCertificateDTO(certificate)).toEqual({
      id: certificate.id,
      name: certificate.name,
      description: certificate.description,
      publicKey: certificate.publicKey,
      privateKey: certificate.privateKey,
      certificate: certificate.certificate,
      expiry: certificate.expiry
    });
  });
});
