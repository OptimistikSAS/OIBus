import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { certificateSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateRepository from '../repository/config/certificate.repository';
import { Certificate } from '../model/certificate.model';
import EncryptionService from './encryption.service';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';
import { generateRandomId } from './utils';
import { DateTime, Duration } from 'luxon';

export default class CertificateService {
  constructor(
    protected readonly validator: JoiValidator,
    private certificateRepository: CertificateRepository,
    private encryptionService: EncryptionService
  ) {}

  findAll(): Array<Certificate> {
    return this.certificateRepository.findAll();
  }

  findById(id: string): Certificate | null {
    return this.certificateRepository.findById(id);
  }

  async create(command: CertificateCommandDTO): Promise<Certificate> {
    if (!command.options) {
      throw new Error('Options must be provided');
    }
    await this.validator.validate(certificateSchema, command);

    const cert = this.encryptionService.generateSelfSignedCertificate({
      commonName: command.options.commonName,
      organizationName: command.options.organizationName,
      countryName: command.options.countryName,
      localityName: command.options.localityName,
      stateOrProvinceName: command.options.stateOrProvinceName,
      daysBeforeExpiry: command.options.daysBeforeExpiry,
      keySize: command.options.keySize
    });
    return this.certificateRepository.create({
      id: generateRandomId(6),
      name: command.name,
      description: command.description,
      publicKey: cert.public,
      privateKey: await this.encryptionService.encryptText(cert.private),
      certificate: cert.cert,
      expiry: DateTime.now()
        .startOf('day')
        .plus(Duration.fromObject({ days: command.options.daysBeforeExpiry }))
        .toISO()!
    });
  }

  async update(certificateId: string, command: CertificateCommandDTO): Promise<void> {
    await this.validator.validate(certificateSchema, command);
    const certificate = this.certificateRepository.findById(certificateId);
    if (!certificate) {
      throw new Error(`Certificate ${certificateId} not found`);
    }

    if (command.regenerateCertificate) {
      if (command.options == null) {
        throw new Error('Options must be provided');
      }
      const cert = this.encryptionService.generateSelfSignedCertificate({
        commonName: command.options.commonName,
        organizationName: command.options.organizationName,
        countryName: command.options.countryName,
        localityName: command.options.localityName,
        stateOrProvinceName: command.options.stateOrProvinceName,
        daysBeforeExpiry: command.options.daysBeforeExpiry,
        keySize: command.options.keySize
      });
      this.certificateRepository.update({
        id: certificateId,
        name: command.name,
        description: command.description,
        publicKey: cert.public,
        privateKey: await this.encryptionService.encryptText(cert.private),
        certificate: cert.cert,
        expiry: DateTime.now()
          .startOf('day')
          .plus(Duration.fromObject({ days: command.options.daysBeforeExpiry }))
          .toISO()!
      });
    } else {
      this.certificateRepository.updateNameAndDescription(certificateId, command.name, command.description);
    }
  }

  async delete(certificateId: string): Promise<void> {
    const certificate = this.certificateRepository.findById(certificateId);
    if (!certificate) {
      throw new Error(`Certificate ${certificateId} not found`);
    }
    this.certificateRepository.delete(certificateId);
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
