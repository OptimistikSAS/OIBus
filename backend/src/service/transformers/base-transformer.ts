import pino from 'pino';
import { Transformer } from '../../model/transformer.model';

export default abstract class BaseTransformer {
  protected constructor(
    protected logger: pino.Logger,
    protected transformer: Transformer
  ) {}

  abstract transform(data: unknown): Promise<unknown>;
}
