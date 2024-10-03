import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { TransformerCommand, TransformerDTO, TransformerSearchParam } from '../../../shared/model/transformer.model';
import { Transformer } from '../../model/transformer.model';

export default class TransformerController extends AbstractController {
  async getTransformers(ctx: KoaContext<void, Array<TransformerDTO>>): Promise<void> {
    try {
      const searchParams: TransformerSearchParam = {
        inputType: ctx.query.inputType as string,
        outputType: ctx.query.outputType as string,
        name: ctx.query.name as string
      };

      const transformers = ctx.app.transformerService.searchTransformers(searchParams);
      ctx.ok(transformers);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async getTransformer(ctx: KoaContext<void, TransformerDTO>): Promise<void> {
    try {
      const transformer = ctx.app.transformerService.findById(ctx.params.id);
      if (!transformer) {
        return ctx.notFound();
      }

      ctx.ok(transformer);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  /**
   * Create a new transformer
   *
   * Optionally include any of the following query parameters:
   * - `northId`: Specifies the ID of the north connector to which the transformer should be added.
   * - `southId`: Specifies the ID of the south connector to which the transformer should be added.
   * - `historyId` and `connectorType`:
   *    - `historyId`: Specifies the ID of the history query to which the transformer should be added.
   *    - `connectorType`: Indicates whether the transformer should be added to the north or south connector.
   */
  async createTransformer(ctx: KoaContext<TransformerCommand, Transformer>): Promise<void> {
    try {
      const transformer = ctx.app.transformerService.create(ctx.request.body as TransformerCommand);

      // TODO
      // // Add transformer to north connector
      // if (ctx.query.northId) {
      //   this.addNorthTransformer(ctx, transformer);
      //   return ctx.created(transformer);
      // }
      //
      // // Add transformer to south connector
      // if (ctx.query.southId) {
      //   this.addSouthTransformer(ctx, transformer);
      //   return ctx.created(transformer);
      // }
      //
      // // Add transformer to history query
      // if (ctx.query.historyId) {
      //   this.addHistoryTransformer(ctx, transformer);
      //   return ctx.created(transformer);
      // }

      // No connector specified
      ctx.created(transformer);
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async updateTransformer(ctx: KoaContext<TransformerCommand, void>) {
    try {
      await ctx.app.transformerService.update(ctx.params.id, ctx.request.body as TransformerCommand);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  /**
   * Delete a transformer
   *
   * Note: This will fail if the transformer is still associated with a connector.
   */
  async deleteTransformer(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.transformerService.delete(ctx.params.id);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
