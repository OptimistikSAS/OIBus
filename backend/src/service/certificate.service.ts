import JoiValidator from '../web-server/controllers/validators/joi.validator';
import {
  certificateSchema,
  certificateImportSchema,
  certificatePrivateKeyExportSchema
} from '../web-server/controllers/validators/oibus-validation-schema';
import CertificateRepository from '../repository/config/certificate.repository';
import { Certificate, CertificateImportCommand } from '../model/certificate.model';
import EncryptionService from './encryption.service';
import { CertificateCommandDTO, CertificateDTO, CertificateExportFormat } from '../../shared/model/certificate.model';
import { generateRandomId } from './utils';
import {
  assertKeyMatchesCertificate,
  certificateContentToPem,
  certificatePemToDer,
  privateKeyContentToPem,
  privateKeyToEncryptedPkcs8Pem,
  readCertificate,
  splitPemChain
} from './utils-certificate';
import type { IOIAnalyticsMessageService } from '../model/oianalytics-message.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { GetUserInfo } from '../../shared/model/types';
import type { ILogger } from '../model/logger.model';

export default class CertificateService {
  constructor(
    protected readonly validator: JoiValidator,
    private certificateRepository: CertificateRepository,
    private encryptionService: EncryptionService,
    private oIAnalyticsMessageService: IOIAnalyticsMessageService,
    private logger: ILogger
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

  async create(command: CertificateCommandDTO, createdBy: string): Promise<Certificate> {
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
      certificateChain: null,
      expiry: readCertificate(cert.cert).expiry,
      createdBy,
      updatedBy: createdBy
    });
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return certificate;
  }

  async update(certificateId: string, command: CertificateCommandDTO, updatedBy: string): Promise<void> {
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
        certificateChain: null,
        expiry: readCertificate(cert.cert).expiry,
        updatedBy
      });
    } else {
      this.certificateRepository.updateNameAndDescription(certificate.id, command.name, command.description, updatedBy);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async import(command: CertificateImportCommand, createdBy: string): Promise<Certificate> {
    await this.validator.validate(certificateImportSchema, { name: command.name, description: command.description });

    const certificatePem = certificateContentToPem(command.certificateContent);
    const parsed = readCertificate(certificatePem);
    const privateKeyPem = privateKeyContentToPem(command.privateKeyContent, command.privateKeyPassphrase);
    assertKeyMatchesCertificate(parsed.pem, privateKeyPem);
    const certificateChain = command.caChainContent ? splitPemChain(certificateContentToPem(command.caChainContent)).join('\n') : null;

    const certificate = this.certificateRepository.create({
      id: generateRandomId(6),
      name: command.name,
      description: command.description,
      publicKey: parsed.publicKeyPem,
      privateKey: await this.encryptionService.encryptText(privateKeyPem),
      certificate: parsed.pem,
      certificateChain,
      expiry: parsed.expiry,
      createdBy,
      updatedBy: createdBy
    });
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return certificate;
  }

  exportCertificate(
    certificateId: string,
    format: CertificateExportFormat,
    includeChain: boolean
  ): { fileName: string; contentType: string; body: string | Buffer } {
    const certificate = this.findById(certificateId);
    const sanitisedName = this.sanitiseFileName(certificate.name);

    if (format === 'DER') {
      if (includeChain) {
        throw new OIBusValidationError('The CA chain cannot be exported in DER format');
      }
      return {
        fileName: `${sanitisedName}.cer`,
        contentType: 'application/pkix-cert',
        body: certificatePemToDer(certificate.certificate)
      };
    }

    const body = [certificate.certificate, includeChain ? certificate.certificateChain : null].filter(Boolean).join('\n');
    return {
      fileName: `${sanitisedName}.pem`,
      contentType: 'application/x-pem-file',
      body
    };
  }

  async exportPrivateKey(
    certificateId: string,
    passphrase: string,
    requestedBy: string
  ): Promise<{ fileName: string; contentType: string; body: string }> {
    await this.validator.validate(certificatePrivateKeyExportSchema, { passphrase });
    const certificate = this.findById(certificateId);
    const privateKeyPem = await this.encryptionService.decryptText(certificate.privateKey);
    const body = privateKeyToEncryptedPkcs8Pem(privateKeyPem, passphrase);
    this.logger.info(`Private key of certificate "${certificate.name}" (${certificate.id}) exported by ${requestedBy}`);
    return {
      fileName: `${this.sanitiseFileName(certificate.name)}-private-key.pem`,
      contentType: 'application/x-pem-file',
      body
    };
  }

  delete(certificateId: string): void {
    const certificate = this.findById(certificateId);
    this.certificateRepository.delete(certificate.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  private sanitiseFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_');
  }
}

export const toCertificateDTO = (certificate: Certificate, getUserInfo: GetUserInfo): CertificateDTO => {
  return {
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
  };
};
