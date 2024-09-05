import { OIBusContent } from '../../../../shared/model/engine.model';
import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';

export default class ContentController extends AbstractController {
  async addContent(ctx: KoaContext<OIBusContent, void>): Promise<void> {
    const { northId } = ctx.request.query;

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
    } catch {
      return ctx.internalServerError();
    }
    return ctx.noContent();
  }
}
