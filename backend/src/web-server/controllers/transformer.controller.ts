import { KoaContext } from '../koa';
import AbstractController from './abstract.controller';
import { TransformerDTO, TransformerCommandDTO, TransformerFilterDTO } from '../../../../shared/model/transformer.model';

export default class TransformerController extends AbstractController {
  async getTransformers(ctx: KoaContext<void, Array<TransformerDTO>>): Promise<void> {
    try {
      const filter: TransformerFilterDTO = {
        inputType: ctx.query.inputType as string,
        outputType: ctx.query.outputType as string,
        name: ctx.query.name as string
      };

      const transformers = ctx.app.repositoryService.transformerRepository.getTransformers(filter);
      ctx.ok(transformers);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async getTransformer(ctx: KoaContext<void, TransformerDTO>): Promise<void> {
    try {
      const transformer = ctx.app.repositoryService.transformerRepository.getTransformer(ctx.params.id);
      if (!transformer) {
        return ctx.notFound();
      }

      ctx.ok(transformer);
    } catch (error: any) {
      ctx.badRequest(error.message);
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
  async createTransformer(ctx: KoaContext<TransformerCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const transformer = ctx.app.repositoryService.transformerRepository.createTransformer(ctx.request.body as TransformerCommandDTO);

      // Add transformer to north connector
      if (ctx.query.northId) {
        this.addNorthTransformer(ctx, transformer);
        return ctx.created(transformer);
      }

      // Add transformer to south connector
      if (ctx.query.southId) {
        this.addSouthTransformer(ctx, transformer);
        return ctx.created(transformer);
      }

      // Add transformer to history query
      if (ctx.query.historyId) {
        this.addHistoryTransformer(ctx, transformer);
        return ctx.created(transformer);
      }

      // No connector specified
      ctx.created(transformer);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateTransformer(ctx: KoaContext<TransformerCommandDTO, void>) {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.transformerRepository.updateTransformer(ctx.params.id, ctx.request.body as TransformerCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  /**
   * Delete a transformer
   *
   * Note: This will fail if the transformer is still associated with a connector.
   */
  async deleteTransformer(ctx: KoaContext<void, void>): Promise<void> {
    try {
      const transformer = ctx.app.repositoryService.transformerRepository.getTransformer(ctx.params.id);
      if (!transformer) {
        return ctx.notFound();
      }

      ctx.app.repositoryService.transformerRepository.deleteTransformer(ctx.params.id);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  /**
   * Add a transformer to a north connector
   * @throws {Error} If the transformer cannot be added to the north connector. This will also rollback the transformer creation.
   */
  private addNorthTransformer(ctx: KoaContext<TransformerCommandDTO, void>, transformer: TransformerDTO) {
    try {
      ctx.app.repositoryService.northTransformerRepository.addTransformer(ctx.query.northId, transformer.id);
    } catch (error: any) {
      // Rollback transformer creation
      ctx.app.repositoryService.transformerRepository.deleteTransformer(transformer.id);
      throw error;
    }
  }

  /**
   * Add a transformer to a south connector
   * @throws {Error} If the transformer cannot be added to the south connector. This will also rollback the transformer creation.
   */
  private addSouthTransformer(ctx: KoaContext<TransformerCommandDTO, void>, transformer: TransformerDTO) {
    try {
      ctx.app.repositoryService.southTransformerRepository.addTransformer(ctx.query.southId, transformer.id);
    } catch (error: any) {
      // Rollback transformer creation
      ctx.app.repositoryService.transformerRepository.deleteTransformer(transformer.id);
      throw error;
    }
  }

  /**
   * Add a transformer to a history query
   * @throws {Error} If the transformer cannot be added to the history query. This will also rollback the transformer creation.
   */
  private addHistoryTransformer(ctx: KoaContext<TransformerCommandDTO, void>, transformer: TransformerDTO) {
    try {
      if (!ctx.query.connectorType) {
        throw new Error('Missing connectorType query parameter');
      }

      if (ctx.query.connectorType !== 'north' && ctx.query.connectorType !== 'south') {
        throw new Error('Invalid connectorType query parameter');
      }

      ctx.app.repositoryService.historyTransformerRepository.addTransformer(ctx.query.historyId, ctx.query.connectorType, transformer.id);
    } catch (error: any) {
      // Rollback transformer creation
      ctx.app.repositoryService.transformerRepository.deleteTransformer(transformer.id);
      throw error;
    }
  }
}
