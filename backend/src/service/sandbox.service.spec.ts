import SandboxService from './sandbox.service';
import pino from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { CacheMetadataSource } from '../../shared/model/engine.model';
import * as fs from 'node:fs';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

jest.mock('./utils', () => ({
  resolveBypassingExports: jest.fn((pkgName, subPath) => `/mock/path/${pkgName}/${subPath}`)
}));
jest.mock('node:fs', () => {
  const real = jest.requireActual<typeof import('node:fs')>('node:fs');
  return { ...real, readFileSync: jest.fn() };
});

// Flag toggled per-describe to exercise the context === null finally branch.
let simulateCreateContextFailure = false;
// Flag toggled per-describe to exercise the silent catch in the metrics finally block.
let simulateHeapStatsFailure = false;

jest.mock('isolated-vm', () => {
  const real = jest.requireActual('isolated-vm') as Record<string, unknown>;
  const OriginalIsolate = real.Isolate as new (options?: object) => unknown;

  function WrappedIsolate(this: unknown, options?: object) {
    if (simulateCreateContextFailure) {
      return {
        createContext: jest.fn().mockRejectedValue(new Error('createContext failed')),
        isDisposed: false,
        dispose: jest.fn(),
        getHeapStatisticsSync: jest.fn().mockImplementation(() => {
          if (simulateHeapStatsFailure) throw new Error('heap stats failed');
          return { used_heap_size: 0 };
        }),
        cpuTime: BigInt(0)
      };
    }
    return new OriginalIsolate(options);
  }
  (WrappedIsolate as unknown as Record<string, unknown>).createSnapshot = (real.Isolate as Record<string, unknown>).createSnapshot;

  const mock = Object.create(real) as Record<string, unknown>;
  Object.defineProperty(mock, 'Isolate', { value: WrappedIsolate, writable: true, configurable: true });
  return mock;
});

const logger: pino.Logger = new PinoLogger();
describe('SandboxService', () => {
  let sandboxService: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockImplementation(filePath => {
      const pathStr = String(filePath);

      // Provide a minimal fake Luxon that satisfies the test
      if (pathStr.includes('luxon')) {
        return `
          module.exports = {
            DateTime: {
              fromISO: function() { return { year: 2026, isValid: true }; }
            }
          };
        `;
      }
      // Provide a minimal fake JSONPath-Plus that satisfies the test
      if (pathStr.includes('jsonpath')) {
        return `
          module.exports = {
            JSONPath: function() { return ['Nigel Rees', 'Evelyn Waugh']; }
          };
        `;
      }
      // Provide a minimal fake PapaParse that satisfies the test
      if (pathStr.includes('papaparse')) {
        return `
          module.exports = {
            parse: function() { return { data: [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }] }; }
          };
        `;
      }
      return '';
    });

    // Instantiate the service (this will now use our fake mocked libraries)
    sandboxService = new SandboxService();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should log snapshot created successfully on first execute', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `function transform() { return { data: 'ok' }; }`
      } as CustomTransformer;

      await sandboxService.execute('', { source: 'test' }, 'file', transformer, {}, logger);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sandbox snapshot created successfully'));
    });

    it('should only log the init message once across multiple executions', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `function transform() { return { data: 'ok' }; }`
      } as CustomTransformer;

      await sandboxService.execute('', { source: 'test' }, 'file1', transformer, {}, logger);
      await sandboxService.execute('', { source: 'test' }, 'file2', transformer, {}, logger);

      const initLogCount = (logger.info as jest.Mock).mock.calls.filter(
        ([arg]) => typeof arg === 'string' && arg.includes('Sandbox snapshot created successfully')
      ).length;
      expect(initLogCount).toBe(1);
    });

    it('should fail gracefully and log a fatal error if library files are missing', async () => {
      // Force the spy to throw an error just for this one specific call
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File not found simulation');
      });

      const brokenService = new SandboxService();

      const dummyTransformer = { customCode: '', language: 'javascript' } as CustomTransformer;

      // Execute should log the error and then fail
      await expect(brokenService.execute('test', { source: 'test' }, 'file.txt', dummyTransformer, {}, logger)).rejects.toThrow(
        'Sandbox execution failed: global is not defined'
      );

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not load sandbox libraries or create snapshot'));
    });
  });

  describe('Execution (Success Cases)', () => {
    const defaultSource: CacheMetadataSource = { source: 'test' };

    it('should execute basic Javascript successfully', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform(content, options, source, filename) {
            return {
              data: { originalContent: content, passedOption: options.myVar },
              filename: 'out_' + filename,
              numberOfElement: 1
            };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      const result = await sandboxService.execute('hello world', defaultSource, 'test.txt', transformer, { myVar: 42 }, logger);

      const parsedOutput = JSON.parse(result.output);
      expect(parsedOutput.originalContent).toBe('hello world');
      expect(parsedOutput.passedOption).toBe(42);
      expect(result.metadata.contentFile).toBe('out_test.txt');
      expect(result.metadata.numberOfElement).toBe(1);
    });

    it('should transpile and execute Typescript successfully', async () => {
      const transformer = {
        language: 'typescript',
        customCode: `
          // Using TS types
          interface Input { message: string; }
          export default function transform(content: string): any {
            const parsed: Input = JSON.parse(content);
            return {
              data: { response: parsed.message.toUpperCase() },
              filename: 'ts_file.json',
              numberOfElement: 1
            };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      const result = await sandboxService.execute(
        JSON.stringify({ message: 'typescript works' }),
        defaultSource,
        'test.txt',
        transformer,
        {},
        logger
      );
      const parsedOutput = JSON.parse(result.output);
      expect(parsedOutput.response).toBe('TYPESCRIPT WORKS');
    });

    it('should use the transpilation cache on repeated executions of the same TypeScript transformer', async () => {
      const transformer = {
        language: 'typescript',
        customCode: `
          export default function transform(content: string): any {
            return { data: content, filename: 'cached.json' };
          }
        `
      } as CustomTransformer;

      const result1 = await sandboxService.execute('first', defaultSource, 'f1.txt', transformer, {}, logger);
      const result2 = await sandboxService.execute('second', defaultSource, 'f2.txt', transformer, {}, logger);

      expect(JSON.parse(result1.output)).toBe('first');
      expect(JSON.parse(result2.output)).toBe('second');
    });

    it('should successfully require and use Luxon', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          const { DateTime } = require('luxon');
          function transform(content) {
            const dt = DateTime.fromISO(content);
            return { data: { year: dt.year }, filename: 'out.json' };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      const result = await sandboxService.execute('2026-01-01', defaultSource, 'test.txt', transformer, {}, logger);
      expect(JSON.parse(result.output).year).toBe(2026);
    });

    it('should successfully require and use JSONPath-Plus', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          const { JSONPath } = require('jsonpath-plus');
          function transform() {
            const results = JSONPath({ path: '$.store.book[*].author', json: {} });
            return { data: results, filename: 'out.json' };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      const result = await sandboxService.execute('{}', defaultSource, 'test.txt', transformer, {}, logger);
      expect(JSON.parse(result.output)).toEqual(['Nigel Rees', 'Evelyn Waugh']);
    });

    it('should successfully require and use PapaParse', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          const Papa = require('papaparse');
          function transform() {
            const result = Papa.parse('name,age');
            return { data: result.data, filename: 'out.json' };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      const result = await sandboxService.execute('', defaultSource, 'test.txt', transformer, {}, logger);
      expect(JSON.parse(result.output)).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' }
      ]);
    });

    it('should log execution metrics on success', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `function transform() { return { data: 'ok', filename: 'f.json' }; }`,
        timeout: 5000
      } as CustomTransformer;

      await sandboxService.execute('', defaultSource, 'metrics.txt', transformer, {}, logger);

      expect(logger.trace).toHaveBeenCalledWith(expect.objectContaining({ msg: expect.stringContaining('Sandbox Execution Metrics') }));
    });
  });

  describe('Execution (Error Handling)', () => {
    const defaultSource: CacheMetadataSource = { source: 'test' };

    it('should catch syntax errors', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `this is not valid javascript !!!`,
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'syntax-err.txt', transformer, {}, logger)).rejects.toThrow(
        /\[RUNTIME_ERROR\]/
      );
    });

    it('should throw if the code does not export a transform function', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `const myFunc = () => { return { data: 'ok' }; };`, // Forgot to name it transform
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'no-fn.txt', transformer, {}, logger)).rejects.toThrow(
        /\[RUNTIME_ERROR\].*Sandbox execution failed: transform is not defined/
      );
    });

    it('should kill the isolate and throw a timeout error on infinite loops', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            while(true) {}
          }
        `,
        timeout: 100
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'timeout.txt', transformer, {}, logger)).rejects.toThrow(/\[TIMEOUT_ERROR\]/);
    });

    it('should map sandbox console.log to the host logger', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            console.trace('This is a trace from the sandbox');
            console.debug('This is a debug from the sandbox');
            console.log('This is a log from the sandbox');
            console.info('This is an info from the sandbox');
            console.warn('This is a warning from the sandbox');
            console.error('This is an error from the sandbox');
            return { data: 'ok' };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      await sandboxService.execute('', defaultSource, 'log.txt', transformer, {}, logger);

      expect(logger.trace).toHaveBeenCalledWith('CUSTOM TRANSFORMER: This is a trace from the sandbox');
      expect(logger.debug).toHaveBeenCalledWith('CUSTOM TRANSFORMER: This is a debug from the sandbox');
      expect(logger.debug).toHaveBeenCalledWith('CUSTOM TRANSFORMER: This is a log from the sandbox');
      expect(logger.info).toHaveBeenCalledWith('CUSTOM TRANSFORMER: This is an info from the sandbox');
      expect(logger.warn).toHaveBeenCalledWith('CUSTOM TRANSFORMER: This is a warning from the sandbox');
      expect(logger.error).toHaveBeenCalledWith('CUSTOM TRANSFORMER: This is an error from the sandbox');
    });

    it('should throw an error when requiring unauthorized modules', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          const fs = require('fs'); // Unauthorized module
          function transform() { return { data: "ok" }; }
        `,
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(
        /Module "fs" is not allowed/
      );
    });

    it('should throw an error when the transform function returns an invalid shape', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            return { wrongKey: "missing data property" };
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(
        /Transform function returned an invalid or empty result/
      );
    });

    it('should catch out-of-memory errors and map them to MEMORY_LIMIT_EXCEEDED', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            const hugeArray = [];
            // Intentionally crash the 256MB V8 heap
            while(true) {
              hugeArray.push(new Array(1000000).fill('memory leak'));
            }
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'oom.txt', transformer, {}, logger)).rejects.toThrow(
        /\[MEMORY_LIMIT_EXCEEDED\]/
      );
    });

    it('should catch TypeScript transpilation errors and map them to SYNTAX_ERROR', async () => {
      // Since we cannot mock the TypeScript compiler directly, we can trigger the exact
      // error-routing logic by having the sandbox throw an error containing the target string.
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            throw new Error('TypeScript compilation failed: Invalid syntax');
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'ts-err.txt', transformer, {}, logger)).rejects.toThrow(
        /\[SYNTAX_ERROR\] Sandbox execution failed: TypeScript compilation failed/
      );
    });

    it('should throw if the code does not export a transform function', async () => {
      // We define 'transform' as a string instead of a function.
      // This prevents V8 from throwing a ReferenceError during script compilation,
      // allowing the code to safely reach the 'typeof transformFnRef !== "function"' check.
      const transformer = {
        language: 'javascript',
        customCode: `
          var transform = "I am a string, not a function!";
        `,
        timeout: 5000
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(
        /Custom code must export a "transform" function/
      );
    });

    it('should throw when transform is a non-function value', async () => {
      // We define 'transform' as a string instead of a function.
      // This prevents V8 from throwing a ReferenceError during script compilation,
      // allowing the code to safely reach the 'typeof transformFnRef !== "function"' check.
      const transformer = {
        language: 'javascript',
        customCode: `
          var transform = "I am a string, not a function!";
        `
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(
        /Custom code must export a "transform" function/
      );
    });
  });

  describe('Execution (with failing heap stats)', () => {
    beforeAll(() => {
      simulateCreateContextFailure = true;
      simulateHeapStatsFailure = true;
    });

    afterAll(() => {
      simulateCreateContextFailure = false;
      simulateHeapStatsFailure = false;
    });

    it('should silently ignore getHeapStatisticsSync failures in the metrics block', async () => {
      const transformer = { language: 'javascript', customCode: 'function transform() {}' } as CustomTransformer;
      await expect(sandboxService.execute('', { source: 'test' }, 'heap-fail.txt', transformer, {}, logger)).rejects.toThrow(
        '[RUNTIME_ERROR] Sandbox execution failed: createContext failed'
      );
      expect(logger.trace).not.toHaveBeenCalledWith(expect.objectContaining({ msg: expect.stringContaining('Sandbox Execution Metrics') }));
    });
  });

  describe('Execution (with failing createContext)', () => {
    beforeAll(() => {
      simulateCreateContextFailure = true;
    });

    afterAll(() => {
      simulateCreateContextFailure = false;
    });

    it('should skip context.release() when context is null', async () => {
      const transformer = { language: 'javascript', customCode: 'function transform() {}' } as CustomTransformer;
      await expect(sandboxService.execute('', { source: 'test' }, 'null-ctx.txt', transformer, {}, logger)).rejects.toThrow(
        '[RUNTIME_ERROR] Sandbox execution failed: createContext failed'
      );
    });
  });
});
