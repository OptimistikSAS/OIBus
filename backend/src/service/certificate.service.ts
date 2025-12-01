import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { certificateSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateRepository from '../repository/config/certificate.repository';
import { Certificate } from '../model/certificate.model';
import EncryptionService from './encryption.service';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';
import { generateRandomId } from './utils';
import { DateTime, Duration } from 'luxon';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { NotFoundError } from '../model/types';

export default class CertificateService {
  constructor(
    protected readonly validator: JoiValidator,
    private certificateRepository: CertificateRepository,
    private encryptionService: EncryptionService,
    private oIAnalyticsMessageService: OIAnalyticsMessageService
  ) {}

  list(): Array<Certificate> {
    return this.certificateRepository.list();
  }

  findById(certificateId: string): Certificate {
    const certificate = this.certificateRepository.findById(certificateId);
    if (!certificate) {
      throw new NotFoundError(`Certificate "${certificateId}" not found`);
    }
    return certificate;
  }

  async create(command: CertificateCommandDTO): Promise<Certificate> {
    await this.validator.validate(certificateSchema, command);
    const cert = await this.encryptionService.generateSelfSignedCertificate({
      commonName: command.options!.commonName,
      organizationName: command.options!.organizationName,
      countryName: command.options!.countryName,
      localityName: command.options!.localityName,
      stateOrProvinceName: command.options!.stateOrProvinceName,
      daysBeforeExpiry: command.options!.daysBeforeExpiry,
      keySize: command.options!.keySize
    });

    const certificate = this.certificateRepository.create({
      id: generateRandomId(6),
      name: command.name,
      description: command.description,
      publicKey: cert.public,
      privateKey: await this.encryptionService.encryptText(cert.private),
      certificate: cert.cert,
      expiry: DateTime.now()
        .startOf('day')
        .plus(Duration.fromObject({ days: command.options!.daysBeforeExpiry }))
        .toISO()!
    });
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return certificate;
  }

  async update(certificateId: string, command: CertificateCommandDTO): Promise<void> {
    await this.validator.validate(certificateSchema, command);
    const certificate = this.findById(certificateId);
    if (command.regenerateCertificate) {
      const cert = await this.encryptionService.generateSelfSignedCertificate({
        commonName: command.options!.commonName,
        organizationName: command.options!.organizationName,
        countryName: command.options!.countryName,
        localityName: command.options!.localityName,
        stateOrProvinceName: command.options!.stateOrProvinceName,
        daysBeforeExpiry: command.options!.daysBeforeExpiry,
        keySize: command.options!.keySize
      });
      this.certificateRepository.update({
        id: certificate.id,
        name: command.name,
        description: command.description,
        publicKey: cert.public,
        privateKey: await this.encryptionService.encryptText(cert.private),
        certificate: cert.cert,
        expiry: DateTime.now()
          .startOf('day')
          .plus(Duration.fromObject({ days: command.options!.daysBeforeExpiry }))
          .toISO()!
      });
    } else {
      this.certificateRepository.updateNameAndDescription(certificate.id, command.name, command.description);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async delete(certificateId: string): Promise<void> {
    const certificate = this.findById(certificateId);
    this.certificateRepository.delete(certificate.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}

export const toCertificateDTO = (certificate: Certificate): Certificate => {
  return {
    id: certificate.id,
    name: certificate.name,
    description: certificate.description,
    publicKey: certificate.publicKey,
    privateKey: certificate.privateKey,
    certificate: certificate.certificate,
    expiry: certificate.expiry
  };
};
