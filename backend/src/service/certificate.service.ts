import {
  CertificateCommandDTO,
  CertificateDTO,
  CertificateExportFormat,
  CertificateOptions
} from '../../shared/model/api/certificate.model';
import { GetUserInfo } from '../../shared/model/common/types';

import { Certificate, CertificateImportCommand, CertificateKeyPair, CertificateUsage } from '../model/certificate.model';
import type { ILogger } from '../model/logger.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import CertificateRepository from '../repository/config/certificate.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import {
  certificateImportSchema,
  certificatePrivateKeyExportSchema,
  certificateSchema
} from '../web-server/controllers/validators/oibus-validation-schema';
import { encryptionService } from './encryption.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { generateRandomId } from './utils';
import {
  assertKeyMatchesCertificate,
  certificateContentToPem,
  certificatePemToDer,
  describeCertificate,
  privateKeyContentToPem,
  privateKeyToEncryptedPkcs8Pem,
  readCertificate,
  readTrustedCertificate,
  splitPemChain
} from './utils-certificate';

export default class CertificateService {
  constructor(
    protected readonly validator: JoiValidator,
    private certificateRepository: CertificateRepository,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
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

  /**
   * The certificate with its private key decrypted, for the connectors and the web server which authenticate with it:
   * they read the certificates of the store through this service only
   */
  getKeyPair(certificateId: string): CertificateKeyPair {
    const certificate = this.findById(certificateId);
    assertKeyPair(certificate, 'present it');
    return {
      name: certificate.name,
      certificate: certificate.certificate,
      certificateChain: certificate.certificateChain,
      privateKey: encryptionService.decryptText(certificate.privateKey)
    };
  }

  async create(command: CertificateCommandDTO, createdBy: string): Promise<Certificate> {
    await this.validator.validate(certificateSchema, command);
    return this.createSelfSigned(command.name, command.description, command.options!, createdBy);
  }

  /**
   * Generates a self-signed certificate and adds it to the store, without validating the options: used by OIBus itself,
   * whose options may leave the subject fields empty.
   */
  async createSelfSigned(name: string, description: string, options: CertificateOptions, createdBy: string): Promise<Certificate> {
    const cert = await encryptionService.generateSelfSignedCertificate({
      commonName: options.commonName,
      organizationName: options.organizationName,
      countryName: options.countryName,
      localityName: options.localityName,
      stateOrProvinceName: options.stateOrProvinceName,
      daysBeforeExpiry: options.daysBeforeExpiry,
      keySize: options.keySize
    });

    const certificate = this.certificateRepository.create({
      id: generateRandomId(6),
      name,
      description,
      kind: 'key-pair',
      publicKey: cert.public,
      privateKey: encryptionService.encryptText(cert.private),
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
      assertKeyPair(certificate, 'regenerate it');
      const cert = await encryptionService.generateSelfSignedCertificate({
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
        privateKey: encryptionService.encryptText(cert.private),
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

  /**
   * Imports a certificate OIBus presents, with its private key, or a certificate OIBus trusts (without private key): a
   * certification authority, or the certificate of a server trusted as is
   */
  async import(command: CertificateImportCommand, createdBy: string): Promise<Certificate> {
    await this.validator.validate(certificateImportSchema, { name: command.name, description: command.description });

    const certificatePem = certificateContentToPem(command.certificateContent);
    if (!command.privateKeyContent) {
      if (command.certificateChainContent) {
        throw new OIBusValidationError('A trusted certificate is imported without chain: import each certificate to trust');
      }
      const trusted = readTrustedCertificate(certificatePem);
      return this.createCertificate(
        {
          name: command.name,
          description: command.description,
          kind: 'trusted',
          publicKey: trusted.publicKeyPem,
          privateKey: '',
          certificate: trusted.pem,
          certificateChain: null,
          expiry: trusted.expiry
        },
        createdBy
      );
    }

    const parsed = readCertificate(certificatePem);
    const privateKeyPem = privateKeyContentToPem(command.privateKeyContent, command.privateKeyPassphrase);
    assertKeyMatchesCertificate(parsed.pem, privateKeyPem);
    const certificateChain = command.certificateChainContent
      ? splitPemChain(certificateContentToPem(command.certificateChainContent)).join('\n')
      : null;

    return this.createCertificate(
      {
        name: command.name,
        description: command.description,
        kind: 'key-pair',
        publicKey: parsed.publicKeyPem,
        privateKey: encryptionService.encryptText(privateKeyPem),
        certificate: parsed.pem,
        certificateChain,
        expiry: parsed.expiry
      },
      createdBy
    );
  }

  /**
   * Trusts the certificate a server presents (PEM), as a connector trusting it reviewed it: added to the store as a trusted
   * certificate, unless the store already trusts this very certificate, which is then reused
   */
  trustServerCertificate(certificatePem: string, name: string, createdBy: string): Certificate {
    const trusted = readTrustedCertificate(certificatePem);
    const fingerprint = describeCertificate(trusted.pem).fingerprint;
    const existing = this.certificateRepository
      .list()
      .find(certificate => certificate.kind === 'trusted' && describeCertificate(certificate.certificate).fingerprint === fingerprint);
    if (existing) {
      return existing;
    }
    return this.createCertificate(
      {
        name,
        description: 'Certificate of a server, trusted from its connector',
        kind: 'trusted',
        publicKey: trusted.publicKeyPem,
        privateKey: '',
        certificate: trusted.pem,
        certificateChain: null,
        expiry: trusted.expiry
      },
      createdBy
    );
  }

  private createCertificate(
    certificate: Omit<Certificate, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    createdBy: string
  ): Certificate {
    const created = this.certificateRepository.create({ ...certificate, id: generateRandomId(6), createdBy, updatedBy: createdBy });
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return created;
  }

  exportCertificate(
    certificateId: string,
    format: CertificateExportFormat,
    includeChain: boolean
  ): { extension: string; content: string | Buffer } {
    const certificate = this.findById(certificateId);

    if (format === 'DER') {
      if (includeChain) {
        throw new OIBusValidationError('The CA chain cannot be exported in DER format');
      }
      return {
        extension: 'cer',
        content: certificatePemToDer(certificate.certificate)
      };
    }

    const content = [certificate.certificate, includeChain ? certificate.certificateChain : null].filter(Boolean).join('');
    return {
      extension: 'pem',
      content
    };
  }

  async exportPrivateKey(certificateId: string, passphrase: string, requestedBy: string): Promise<string> {
    await this.validator.validate(certificatePrivateKeyExportSchema, { passphrase });
    const certificate = this.findById(certificateId);
    assertKeyPair(certificate, 'export its private key');
    const privateKeyPem = encryptionService.decryptText(certificate.privateKey);
    const content = privateKeyToEncryptedPkcs8Pem(privateKeyPem, passphrase);
    this.logger.info(`Private key of certificate "${certificate.name}" (${certificate.id}) exported by ${requestedBy}`);
    return content;
  }

  /**
   * Delete a certificate, unless a connector, a history query or the web server uses it: they could no longer connect, or
   * serve HTTPS
   */
  delete(certificateId: string, userId: string): void {
    const certificate = this.findById(certificateId);
    const usages = this.certificateRepository.findUsages(certificate.id);
    if (usages.length > 0) {
      throw new OIBusValidationError(
        `Certificate "${certificate.name}" is used by ${usages.map(describeUsage).join(', ')}: select another certificate there before deleting it`
      );
    }
    this.certificateRepository.delete(certificate.id, userId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }
}

const USAGE_LABELS: Record<CertificateUsage['type'], string> = {
  south: 'the South connector',
  north: 'the North connector',
  'history-query': 'the history query',
  'web-server': 'the web server (HTTPS)',
  registration: 'the registration with OIAnalytics'
};

const describeUsage = (usage: CertificateUsage): string =>
  usage.type === 'web-server' || usage.type === 'registration' ? USAGE_LABELS[usage.type] : `${USAGE_LABELS[usage.type]} "${usage.name}"`;

export const toCertificateDTO = (certificate: Certificate, getUserInfo: GetUserInfo): CertificateDTO => {
  return {
    id: certificate.id,
    name: certificate.name,
    description: certificate.description,
    publicKey: certificate.publicKey,
    certificate: certificate.certificate,
    certificateChain: certificate.certificateChain,
    expiry: certificate.expiry,
    kind: certificate.kind,
    ...describeCertificate(certificate.certificate),
    createdBy: getUserInfo(certificate.createdBy),
    updatedBy: getUserInfo(certificate.updatedBy),
    createdAt: certificate.createdAt,
    updatedAt: certificate.updatedAt
  };
};

/**
 * Refuses an operation needing the private key of a certificate on a trusted certificate, which has none
 */
const assertKeyPair = (certificate: Certificate, operation: string): void => {
  if (certificate.kind === 'trusted') {
    throw new OIBusValidationError(`Certificate "${certificate.name}" is a trusted certificate, without private key: cannot ${operation}`);
  }
};
