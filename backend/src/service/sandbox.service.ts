import ivm from 'isolated-vm';
import { OIBusContent } from '../../../shared/model/engine.model';
import { TransformerDTO } from '../../../shared/model/transformer.model';
import { Logger } from 'pino';

export default class SandboxService {
  /** Isolated sandbox  */
  private isolate = new ivm.Isolate();

  constructor(private readonly logger: Logger) {}

  public async execute<TOutput>(transformer: TransformerDTO, data: OIBusContent): Promise<TOutput | null> {
    let context: ivm.Context | null = null;
    let result: TOutput | null = null;

    try {
      const script = await this.isolate.compileScript(transformer.code);

      // Create a new context for each run, in order to not pass data between runs
      context = await this.isolate.createContext();
      const jail = context.global;

      // This makes the global object available in the context as `global`. We use `derefInto()` here
      // because otherwise `global` would actually be a Reference{} object in the new isolate.
      await jail.set('global', jail.derefInto());

      // Add script to the context
      // this call adds the transform, and any other function to the global scope
      await script.run(context);

      // Retrieve a refference to the transform function inside the isolate
      const transformFnRef = await jail.get('transform', { reference: true });
      // Call the transform function
      // Deep copy input arguments and the result, to not leak refferences
      const _result = await transformFnRef.apply(undefined, [data], {
        arguments: { copy: true },
        result: { copy: true, promise: true } // Copy is needed to be able to retrieve any value returned
      });

      result = _result as TOutput;
    } catch (error: any) {
      this.logger.error('Could not transform data: %o', error);
      return null;
    } finally {
      context?.release();
    }

    return result;
  }
}
