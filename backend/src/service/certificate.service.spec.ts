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

  it('findAll() should find all certificated', () => {
    (certificateRepository.findAll as jest.Mock).mockReturnValueOnce(testData.certificates.list);

    const result = service.findAll();

    expect(certificateRepository.findAll).toHaveBeenCalled();
    expect(result).toEqual(testData.certificates.list.map(element => toCertificateDTO(element)));
  });

  it('findById() should find a certificate by id', () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    const result = service.findById(testData.certificates.list[0].id);

    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(result).toEqual(toCertificateDTO(testData.certificates.list[0]));
  });

  it('create() should create a certificate', async () => {
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

  it('create() should not create if options is null', async () => {
    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.options = null;
    await expect(service.create(command)).rejects.toThrow('Options must be provided');
  });

  it('update() should update a certificate', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);
    (encryptionService.generateSelfSignedCertificate as jest.Mock).mockReturnValueOnce({
      public: 'public',
      private: 'private',
      cert: 'cert'
    });
    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.regenerateCertificate = true;

    await service.update('newId', command);

    expect(validator.validate).toHaveBeenCalledWith(certificateSchema, command);
    expect(certificateRepository.findById).toHaveBeenCalledWith('newId');
    expect(certificateRepository.update).toHaveBeenCalledWith({
      id: 'newId',
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

  it('update() should not update if the certificate is not found', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update('newId', testData.certificates.command)).rejects.toThrow(new Error(`Certificate newId not found`));

    expect(certificateRepository.findById).toHaveBeenCalledWith('newId');
    expect(certificateRepository.update).not.toHaveBeenCalled();
  });

  it('update() should not update if options is null', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.options = null;
    command.regenerateCertificate = true;

    await expect(service.update('newId', command)).rejects.toThrow('Options must be provided');
  });

  it('update() should not update if options is null', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.options = null;
    command.regenerateCertificate = true;

    await expect(service.update('newId', command)).rejects.toThrow('Options must be provided');
  });

  it('update() should just update name and description if regenerateCertificate is false', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    const command: CertificateCommandDTO = JSON.parse(JSON.stringify(testData.certificates.command));
    command.regenerateCertificate = false;
    await service.update('newId', command);
    expect(certificateRepository.updateNameAndDescription).toHaveBeenCalledWith('newId', command.name, command.description);
  });

  it('delete() should delete a certificate', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(testData.certificates.list[0]);

    await service.delete(testData.certificates.list[0].id);

    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(certificateRepository.delete).toHaveBeenCalledWith(testData.certificates.list[0].id);
  });

  it('delete() should not delete if the certificate is not found', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.delete(testData.certificates.list[0].id)).rejects.toThrow(
      new Error(`Certificate ${testData.certificates.list[0].id} not found`)
    );

    expect(certificateRepository.findById).toHaveBeenCalledWith(testData.certificates.list[0].id);
    expect(certificateRepository.delete).not.toHaveBeenCalled();
  });
});
