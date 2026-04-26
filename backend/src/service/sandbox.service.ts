import ivm from 'isolated-vm';
import ts from 'typescript';
import { Logger } from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';
import * as fs from 'node:fs';
import { resolveBypassingExports } from './utils';

interface ResultOutput {
  data: string;
  filename: string;
  numberOfElement?: number;
}

export default class SandboxService {
  private readonly snapshot: ivm.ExternalCopy<ArrayBuffer> | null = null;
  private readonly initMessage: { level: 'info' | 'error'; text: string };
  private initLogged = false;
  private readonly tsCache = new Map<string, string>();

  constructor() {
    try {
      const luxonSource = fs.readFileSync(resolveBypassingExports('luxon', 'build/global/luxon.min.js'), 'utf8');
      const jsonPathSource = fs.readFileSync(resolveBypassingExports('jsonpath-plus', 'dist/index-browser-umd.cjs'), 'utf8');
      const papaParseSource = fs.readFileSync(resolveBypassingExports('papaparse', 'papaparse.min.js'), 'utf8');

      // This script runs ONCE during service initialization to build the frozen heap.
      const snapshotSetupCode = `
        var window = this;
        var global = this;
        var globalThis = this;
        var self = this;

        // Load Luxon
        var module = { exports: {} };
        var exports = module.exports;
        ${luxonSource}
        global.luxon = module.exports.DateTime ? module.exports : (globalThis.luxon || window.luxon);

        // Load JSONPath-Plus
        module = { exports: {} };
        exports = module.exports;
        ${jsonPathSource}
        global.jsonpath = module.exports.JSONPath || module.exports || globalThis.JSONPath;

        // Load PapaParse
        module = { exports: {} };
        exports = module.exports;
        ${papaParseSource}
        global.papaparse = module.exports.parse ? module.exports : (globalThis.Papa || window.Papa);
      `;

      // We store the snapshot in memory to instantly clone new Isolates from it.
      this.snapshot = ivm.Isolate.createSnapshot([{ code: snapshotSetupCode }]);
      this.initMessage = { level: 'info', text: 'Sandbox snapshot created successfully.' };
    } catch (e) {
      this.initMessage = { level: 'error', text: `Could not load sandbox libraries or create snapshot: ${(e as Error).message}` };
      this.snapshot = null;
    }
  }

  public async execute(
    stringContent: string,
    source: CacheMetadataSource,
    filename: string,
    transformer: CustomTransformer,
    options: object,
    logger: Logger
  ): Promise<{ metadata: CacheMetadata; output: string }> {
    if (!this.initLogged) {
      logger[this.initMessage.level](this.initMessage.text);
      this.initLogged = true;
    }
    const startTime = process.hrtime.bigint();
    const memoryLimitMb = 256;

    const isolateOptions: ivm.IsolateOptions = { memoryLimit: memoryLimitMb };
    if (this.snapshot) {
      isolateOptions.snapshot = this.snapshot;
    }
    const isolate = new ivm.Isolate(isolateOptions);
    let context: ivm.Context | null = null;

    try {
      context = await isolate.createContext();
      const jail = context.global;

      // These cannot be snapshotted, so we do them at execution time.
      await jail.set('_trace', new ivm.Reference((...args: Array<unknown>) => logger.trace(['CUSTOM TRANSFORMER:', ...args].join(' '))));
      await jail.set('_debug', new ivm.Reference((...args: Array<unknown>) => logger.debug(['CUSTOM TRANSFORMER:', ...args].join(' '))));
      await jail.set('_log', new ivm.Reference((...args: Array<unknown>) => logger.debug(['CUSTOM TRANSFORMER:', ...args].join(' '))));
      await jail.set('_info', new ivm.Reference((...args: Array<unknown>) => logger.info(['CUSTOM TRANSFORMER:', ...args].join(' '))));
      await jail.set('_warn', new ivm.Reference((...args: Array<unknown>) => logger.warn(['CUSTOM TRANSFORMER:', ...args].join(' '))));
      await jail.set('_error', new ivm.Reference((...args: Array<unknown>) => logger.error(['CUSTOM TRANSFORMER:', ...args].join(' '))));

      await context.eval(`
        global.console = {
          trace: (...args) => _trace.apply(undefined, args, { arguments: { copy: true } }),
          debug: (...args) => _debug.apply(undefined, args, { arguments: { copy: true } }),
          log: (...args) => _log.apply(undefined, args, { arguments: { copy: true } }),
          info: (...args) => _info.apply(undefined, args, { arguments: { copy: true } }),
          warn: (...args) => _warn.apply(undefined, args, { arguments: { copy: true } }),
          error: (...args) => _error.apply(undefined, args, { arguments: { copy: true } })
        };
      `);

      let codeToExecute = transformer.customCode;
      if (transformer.language === 'typescript') {
        const cached = this.tsCache.get(transformer.customCode);
        if (cached !== undefined) {
          codeToExecute = cached;
        } else {
          try {
            const transpileResult = ts.transpileModule(transformer.customCode, {
              compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
            });
            codeToExecute = transpileResult.outputText;
            this.tsCache.set(transformer.customCode, codeToExecute);
          } catch (e) {
            throw new Error(`TypeScript compilation failed: ${(e as Error).message}`);
          }
        }
      }

      // We wrap the user code, and because of the snapshot,
      // global.luxon, global.papaparse, etc., are ALREADY populated instantly!
      const wrappedCode = `
        function require(name) {
          if (name === 'luxon') {
            if (!global.luxon || !global.luxon.DateTime) throw new Error("Luxon is missing from the snapshot.");
            return global.luxon;
          }
          if (name === 'jsonpath-plus' || name === 'jsonpath') {
            if (!global.jsonpath) throw new Error("JSONPath is missing from the snapshot.");
            // Wrap the function in an object to support TS destructuring: import { JSONPath } from ...
            return { JSONPath: global.jsonpath, default: global.jsonpath };
          }
          if (name === 'papaparse') {
            if (!global.papaparse) throw new Error("PapaParse is missing from the snapshot.");
            return global.papaparse;
          }
          throw new Error('Module "' + name + '" is not allowed.');
        }

        var exports = {}; var module = { exports: exports };
        ${codeToExecute}
        global.__sandbox_transform = module.exports.default || module.exports.transform || transform;
      `;

      const script = await isolate.compileScript(wrappedCode);
      await script.run(context, { timeout: transformer.timeout });

      const transformFnRef = await jail.get('__sandbox_transform', { reference: true });
      if (typeof transformFnRef === 'undefined' || transformFnRef.typeof !== 'function') {
        throw new Error('Custom code must export a "transform" function.');
      }

      const _resultRef = (await transformFnRef.apply(
        undefined,
        [
          new ivm.ExternalCopy(stringContent).copyInto(),
          new ivm.ExternalCopy(source).copyInto(),
          new ivm.ExternalCopy(filename).copyInto(),
          new ivm.ExternalCopy(options).copyInto()
        ],
        {
          result: { copy: true, promise: true },
          timeout: transformer.timeout
        }
      )) as ResultOutput;

      if (!_resultRef || !_resultRef.data) {
        throw new Error('Transform function returned an invalid or empty result.');
      }

      return {
        output: typeof _resultRef.data === 'string' ? _resultRef.data : JSON.stringify(_resultRef.data),
        metadata: {
          contentFile: _resultRef.filename,
          contentSize: Buffer.byteLength(stringContent, 'utf8'),
          createdAt: new Date().toISOString(),
          numberOfElement: _resultRef.numberOfElement || 0,
          contentType: transformer.outputType
        }
      };
    } catch (error: unknown) {
      let errorCategory = 'RUNTIME_ERROR';
      if ((error as Error).message.includes('Script execution timed out')) {
        errorCategory = 'TIMEOUT_ERROR';
      } else if ((error as Error).message.includes('Isolate was disposed') || (error as Error).message.includes('memory')) {
        errorCategory = 'MEMORY_LIMIT_EXCEEDED';
      } else if ((error as Error).message.includes('TypeScript compilation failed')) {
        errorCategory = 'SYNTAX_ERROR';
      }
      throw new Error(`[${errorCategory}] Custom code execution failed: ${(error as Error).message}`);
    } finally {
      if (!isolate.isDisposed) {
        try {
          const heapStats = isolate.getHeapStatisticsSync();
          const cpuTimeNs = isolate.cpuTime;
          const totalDurationMs = Number(process.hrtime.bigint() - startTime) / 1e6;

          logger.trace({
            msg: `Sandbox Execution Metrics for ${filename}: ${JSON.stringify(
              {
                cpuTimeMs: Number(cpuTimeNs) / 1e6,
                totalDurationMs: totalDurationMs,
                heapUsedMb: (heapStats.used_heap_size / (1024 * 1024)).toFixed(2)
              },
              null,
              2
            )}`
          });
        } catch {
          /* ignore */
        }
      }
      if (context) {
        context.release();
      }
      if (!isolate.isDisposed) {
        isolate.dispose();
      }
    }
  }
}

export const sandboxService = new SandboxService();
