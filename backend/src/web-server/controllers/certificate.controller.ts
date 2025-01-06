import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { CertificateCommandDTO, CertificateDTO } from '../../../shared/model/certificate.model';
import { toCertificateDTO } from '../../service/certificate.service';

export default class CertificateController extends AbstractController {
  async findAll(ctx: KoaContext<void, Array<CertificateDTO>>): Promise<void> {
    const certificates = ctx.app.certificateService.findAll().map(c => toCertificateDTO(c));
    ctx.ok(certificates);
  }

  async findById(ctx: KoaContext<void, CertificateDTO>): Promise<void> {
    const certificate = ctx.app.certificateService.findById(ctx.params.id);
    if (certificate) {
      ctx.ok(toCertificateDTO(certificate));
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<CertificateCommandDTO, void>): Promise<void> {
    try {
      const certificate = await ctx.app.certificateService.create(ctx.request.body!);
      ctx.created(toCertificateDTO(certificate));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<CertificateCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.certificateService.update(ctx.params.id, ctx.request.body!);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.certificateService.delete(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
