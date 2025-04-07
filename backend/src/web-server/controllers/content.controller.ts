import { OIBusContent, OIBusTimeValueContent } from '../../../shared/model/engine.model';
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
      content = { type: 'any', filePath: ctx.request.file.path };
    } else {
      const body = ctx.request.body! as OIBusTimeValueContent;
      content = { type: 'time-values', content: body.content };
    }
    await this.validate(content);

    try {
      for (const id of ids) {
        await ctx.app.oIBusService.addExternalContent(id, content, 'api');
      }
    } catch (error: unknown) {
      return ctx.badRequest((error as Error).message);
    }
    return ctx.noContent();
  }
}
