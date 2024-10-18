import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { CertificateCommandDTO, CertificateDTO } from '../../../../shared/model/certificate.model';
import { generateRandomId } from '../../service/utils';
import { DateTime, Duration } from 'luxon';
import { Certificate } from '../../model/certificate.model';

export default class CertificateController extends AbstractController {
  async findAll(ctx: KoaContext<void, Array<CertificateDTO>>): Promise<void> {
    const certificates = ctx.app.repositoryService.certificateRepository.findAll().map(c => this.toCertificateDTO(c));
    ctx.ok(certificates);
  }

  async findById(ctx: KoaContext<void, CertificateDTO>): Promise<void> {
    const certificate = ctx.app.repositoryService.certificateRepository.findById(ctx.params.id);
    if (certificate) {
      ctx.ok(this.toCertificateDTO(certificate));
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<CertificateCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      // generate self-signed certificate with the command
      const command = ctx.request.body!;
      if (command.options == null) {
        ctx.badRequest('Options must be provided');
        return;
      }
      const cert = ctx.app.encryptionService.generateSelfSignedCertificate({
        commonName: command.options.commonName,
        organizationName: command.options.organizationName,
        countryName: command.options.countryName,
        localityName: command.options.localityName,
        stateOrProvinceName: command.options.stateOrProvinceName,
        daysBeforeExpiry: command.options.daysBeforeExpiry,
        keySize: command.options.keySize
      });
      const certificate = ctx.app.repositoryService.certificateRepository.create({
        id: generateRandomId(6),
        name: command.name,
        description: command.description,
        publicKey: cert.public,
        privateKey: await ctx.app.encryptionService.encryptText(cert.private),
        certificate: cert.cert,
        expiry: DateTime.now()
          .startOf('day')
          .plus(Duration.fromObject({ days: command.options.daysBeforeExpiry }))
          .toISO()!
      });
      ctx.created(certificate);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<CertificateCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const certificateToUpdate = ctx.app.repositoryService.certificateRepository.findById(ctx.params.id);
      if (certificateToUpdate == null) {
        ctx.notFound();
        return;
      }

      // generate self-signed certificate with the command
      const command = ctx.request.body!;

      if (command.regenerateCertificate) {
        if (command.options == null) {
          ctx.badRequest('Options must be provided');
          return;
        }
        const cert = ctx.app.encryptionService.generateSelfSignedCertificate({
          commonName: command.options.commonName,
          organizationName: command.options.organizationName,
          countryName: command.options.countryName,
          localityName: command.options.localityName,
          stateOrProvinceName: command.options.stateOrProvinceName,
          daysBeforeExpiry: command.options.daysBeforeExpiry,
          keySize: command.options.keySize
        });
        ctx.app.repositoryService.certificateRepository.update({
          id: certificateToUpdate.id,
          name: command.name,
          description: command.description,
          publicKey: cert.public,
          privateKey: await ctx.app.encryptionService.encryptText(cert.private),
          certificate: cert.cert,
          expiry: DateTime.now()
            .startOf('day')
            .plus(Duration.fromObject({ days: command.options.daysBeforeExpiry }))
            .toISO()!
        });
      } else {
        ctx.app.repositoryService.certificateRepository.updateNameAndDescription(certificateToUpdate.id, command.name, command.description);
      }
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    const certificate = ctx.app.repositoryService.certificateRepository.findById(ctx.params.id);
    if (certificate) {
      ctx.app.repositoryService.certificateRepository.delete(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }

  toCertificateDTO(certificate: Certificate): CertificateDTO {
    return {
      id: certificate.id,
      name: certificate.name,
      description: certificate.description,
      publicKey: certificate.publicKey,
      certificate: certificate.certificate,
      expiry: certificate.expiry
    };
  }
}
