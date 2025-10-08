import ivm from 'isolated-vm';
import { Logger } from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { CacheMetadata } from '../../shared/model/engine.model';
import ts from 'typescript';

interface ResultOutput<TOutput> {
  data: TOutput;
  filename: string;
  numberOfElement?: number;
}

export default class SandboxService {
  constructor(private readonly logger: Logger) {}

  public async execute<TOutput>(
    stringContent: string,
    source: string,
    filename: string,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    if (transformer.language === 'typescript') {
      return this.executeTypeScript<TOutput>(stringContent, source, filename, transformer, options);
    } else {
      return this.executeJavaScript<TOutput>(stringContent, source, filename, transformer, options);
    }
  }

  private async executeJavaScript<TOutput>(
    stringContent: string,
    source: string,
    filename: string,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const isolate = new ivm.Isolate();
    let context: ivm.Context | null = null;
    try {
      const script = await isolate.compileScript(transformer.customCode);
      context = await isolate.createContext();

      const jail = context.global;
      await jail.set('global', jail.derefInto());
      await script.run(context);

      const transformFnRef = await jail.get('transform', { reference: true });

      const _result = (await transformFnRef.apply(undefined, [stringContent, source, filename, options], {
        arguments: { copy: true },
        result: { copy: true, promise: true },
        timeout: 5000
      })) as ResultOutput<TOutput>;

      if (!_result || !_result.data) {
        throw new Error(`Transform function did not return a valid result: ${JSON.stringify(_result)}`);
      }

      const result = {
        data: _result.data as TOutput,
        filename: _result.filename,
        numberOfElement: _result.numberOfElement || 0
      };

      return {
        output: JSON.stringify(result.data as TOutput),
        metadata: {
          contentFile: result.filename,
          contentSize: 0,
          createdAt: '',
          numberOfElement: result.numberOfElement || 0,
          contentType: transformer.outputType,
          source,
          options: {}
        }
      };
    } finally {
      if (context) {
        context.release();
      }
    }
  }

  private async executeTypeScript<TOutput>(
    stringContent: string,
    source: string,
    filename: string,
    transformer: CustomTransformer,
    options: object
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    const isolate = new ivm.Isolate();
    let context: ivm.Context | null = null;
    try {
      // Compile TypeScript to JavaScript
      let compiledCode: string;
      try {
        compiledCode = ts.transpile(transformer.customCode, {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.Preserve,
          allowJs: true,
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: false
        });
      } catch (compileError) {
        throw new Error(`TypeScript compilation failed: ${compileError instanceof Error ? compileError.message : String(compileError)}`);
      }

      const script = await isolate.compileScript(compiledCode);
      context = await isolate.createContext();

      const jail = context.global;
      await jail.set('global', jail.derefInto());
      await script.run(context);

      const transformFnRef = await jail.get('transform', { reference: true });

      const _result = (await transformFnRef.apply(undefined, [stringContent, source, filename, options], {
        arguments: { copy: true },
        result: { copy: true, promise: true },
        timeout: 5000
      })) as ResultOutput<TOutput>;

      if (!_result || !_result.data) {
        throw new Error(`Transform function did not return a valid result: ${JSON.stringify(_result)}`);
      }

      const result = {
        data: _result.data as TOutput,
        filename: _result.filename,
        numberOfElement: _result.numberOfElement || 0
      };

      return {
        output: JSON.stringify(result.data as TOutput),
        metadata: {
          contentFile: result.filename,
          contentSize: 0,
          createdAt: '',
          numberOfElement: result.numberOfElement || 0,
          contentType: transformer.outputType,
          source,
          options: {}
        }
      };
    } finally {
      if (context) {
        context.release();
      }
    }
  }
}
