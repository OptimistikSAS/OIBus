import { OIBusContent } from '../../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';

export default class ContentController extends AbstractController {
  async addContent(ctx: KoaContext<OIBusContent, void>): Promise<void> {
    const { name, northId } = ctx.request.query;
    if (!name) {
      return ctx.badRequest();
    }
    const externalSource = ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference(name as string);
    if (!externalSource) {
      ctx.app.logger.info(`External source "${name}" not found`);
      return ctx.badRequest();
    }

    const ids = [];
    if (typeof northId === 'string') {
      ids.push(northId);
    } else if (Array.isArray(northId)) {
      ids.push(...northId);
    }

    let content: OIBusContent;
    if (ctx.request.file) {
      content = { type: 'raw', filePath: ctx.request.file.path };
    } else {
      content = ctx.request.body!;
    }
    await this.validate(content);

    try {
      for (const id of ids) {
        await ctx.app.oibusService.addExternalContent(id, content);
      }
    } catch (error) {
      return ctx.internalServerError();
    }
    return ctx.noContent();
  }
}
