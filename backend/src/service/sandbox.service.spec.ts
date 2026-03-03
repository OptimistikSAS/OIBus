import SandboxService from './sandbox.service';
import pino from 'pino';
import { CustomTransformer } from '../model/transformer.model';
import { CacheMetadataSource } from '../../shared/model/engine.model';
import * as fs from 'node:fs';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

jest.mock('./utils', () => ({
  resolveBypassingExports: jest.fn((pkgName, subPath) => `/mock/path/${pkgName}/${subPath}`)
}));
jest.mock('node:fs');

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
        `
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
        `
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
            const dt = DateTime.fromISO('2026-02-19T14:30:00Z');
            return { data: { year: dt.year, isValid: dt.isValid } };
          }
        `
      } as CustomTransformer;

      const result = await sandboxService.execute('', defaultSource, 'file', transformer, {}, logger);
      const parsedOutput = JSON.parse(result.output);
      expect(parsedOutput.year).toBe(2026);
      expect(parsedOutput.isValid).toBe(true);
    });

    it('should successfully require and use JSONPath-Plus', async () => {
      const transformer = {
        language: 'typescript',
        customCode: `
          import { JSONPath } from 'jsonpath-plus';
          export function transform(content: string) {
            const obj = JSON.parse(content);
            const res = JSONPath({ json: obj, path: '$.store.book[*].author' });
            return { data: res };
          }
        `
      } as CustomTransformer;

      const testJson = JSON.stringify({
        store: { book: [{ author: 'Nigel Rees' }, { author: 'Evelyn Waugh' }] }
      });

      const result = await sandboxService.execute(testJson, defaultSource, 'file', transformer, {}, logger);
      const parsedOutput = JSON.parse(result.output);
      expect(parsedOutput).toEqual(['Nigel Rees', 'Evelyn Waugh']);
    });

    it('should successfully require and use PapaParse', async () => {
      const transformer = {
        language: 'typescript',
        customCode: `
          import * as Papa from 'papaparse';
          export function transform(content: string) {
            const parsed = Papa.parse(content, { header: true });
            return { data: parsed.data };
          }
        `
      } as CustomTransformer;

      const testCsv = 'name,age\nAlice,30\nBob,25';

      const result = await sandboxService.execute(testCsv, defaultSource, 'file', transformer, {}, logger);
      const parsedOutput = JSON.parse(result.output);
      expect(parsedOutput).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' }
      ]);
    });

    it('should log execution metrics on success', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `function transform() { return { data: "ok" }; }`
      } as CustomTransformer;

      await sandboxService.execute('', defaultSource, 'metric.txt', transformer, {}, logger);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Sandbox Execution Metrics for metric.txt',
          metrics: expect.objectContaining({
            cpuTimeMs: expect.any(Number),
            totalDurationMs: expect.any(Number),
            heapUsedMb: expect.any(String)
          })
        })
      );
    });
  });

  describe('Execution (Error Handling)', () => {
    const defaultSource: CacheMetadataSource = { source: 'test' };

    it('should catch syntax errors', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `export function transform() { const a = ; return { data: "bad" }; }`
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(
        /\[RUNTIME_ERROR\].*Unexpected token/
      );
    });

    it('should throw if the code does not export a transform function', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `const myFunc = () => { return { data: "ok" }; };` // Forgot to name it transform
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(
        /\[RUNTIME_ERROR\].*Sandbox execution failed: transform is not defined/
      );
    });

    it('should kill the isolate and throw a timeout error on infinite loops', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            while(true) {} // Infinite loop
          }
        `
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
        `
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
        `
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger)).rejects.toThrow(/Module "fs" is not allowed/);
    });

    it('should throw an error when the transform function returns an invalid shape', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            return { wrongKey: "missing data property" };
          }
        `
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
        `
      } as CustomTransformer;

      await expect(sandboxService.execute('', defaultSource, 'oom.txt', transformer, {}, logger)).rejects.toThrow(/\[MEMORY_LIMIT_EXCEEDED\]/);
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
});
