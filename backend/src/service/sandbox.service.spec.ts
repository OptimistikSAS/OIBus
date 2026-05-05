import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import type { CustomTransformer } from '../model/transformer.model';
import type { CacheMetadataSource } from '../../shared/model/engine.model';
import type SandboxServiceClass from './sandbox.service';

const nodeRequire = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Shared readFileSync mock implementation (luxon / jsonpath-plus / papaparse)
// ---------------------------------------------------------------------------
function fakeReadFileSync(filePath: unknown): string {
  const pathStr = String(filePath);

  if (pathStr.includes('luxon')) {
    return `
      module.exports = {
        DateTime: {
          fromISO: function() { return { year: 2026, isValid: true }; }
        }
      };
    `;
  }
  if (pathStr.includes('jsonpath')) {
    return `
      module.exports = {
        JSONPath: function() { return ['Nigel Rees', 'Evelyn Waugh']; }
      };
    `;
  }
  if (pathStr.includes('papaparse')) {
    return `
      module.exports = {
        parse: function() { return { data: [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }] }; }
      };
    `;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Main suite — uses the real isolated-vm, only ./utils and node:fs are mocked
// ---------------------------------------------------------------------------
describe('SandboxService', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;

  const logger = new PinoLogger();

  const utilsExports = {
    __esModule: true,
    resolveBypassingExports: mock.fn((pkgName: string, subPath: string) => `/mock/path/${pkgName}/${subPath}`)
  };

  before(() => {
    mockModule(nodeRequire, './utils', utilsExports);
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    mock.method(fs, 'readFileSync', fakeReadFileSync);
    utilsExports.resolveBypassingExports.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    sandboxService = new SandboxService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('Initialization', () => {
    it('should log snapshot created successfully on first execute', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `function transform() { return { data: 'ok' }; }`
      } as CustomTransformer;

      await sandboxService.execute('', { source: 'test' }, 'file', transformer, {}, logger);
      const infoMessages: Array<string> = logger.info.mock.calls.map(c => String(c.arguments[0]));
      assert.ok(
        infoMessages.some(m => m.includes('Sandbox snapshot created successfully')),
        'Expected info log containing "Sandbox snapshot created successfully"'
      );
    });

    it('should only log the init message once across multiple executions', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `function transform() { return { data: 'ok' }; }`
      } as CustomTransformer;

      await sandboxService.execute('', { source: 'test' }, 'file1', transformer, {}, logger);
      await sandboxService.execute('', { source: 'test' }, 'file2', transformer, {}, logger);

      const initLogCount = logger.info.mock.calls.filter(
        c => typeof c.arguments[0] === 'string' && (c.arguments[0] as string).includes('Sandbox snapshot created successfully')
      ).length;
      assert.strictEqual(initLogCount, 1);
    });

    it('should fail gracefully and log a fatal error if library files are missing', async () => {
      // Force a throw on the very first readFileSync call (library loading in constructor)
      mock.restoreAll();
      mock.method(fs, 'readFileSync', () => {
        throw new Error('File not found simulation');
      });

      const brokenService = new SandboxService();

      const dummyTransformer = { customCode: '', language: 'javascript' } as CustomTransformer;

      await assert.rejects(
        async () => brokenService.execute('test', { source: 'test' }, 'file.txt', dummyTransformer, {}, logger),
        /Custom code execution failed: global is not defined/
      );

      const errorMessages: Array<string> = logger.error.mock.calls.map(c => String(c.arguments[0]));
      assert.ok(
        errorMessages.some(m => m.includes('Could not load sandbox libraries or create snapshot')),
        'Expected error log containing "Could not load sandbox libraries or create snapshot"'
      );
    });
  });

  describe('Execution (Success Cases)', () => {
    const defaultSource: CacheMetadataSource = { source: 'test' };

    it('should execute basic Javascript successfully', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform(content, source, filename, options) {
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
      assert.strictEqual(parsedOutput.originalContent, 'hello world');
      assert.strictEqual(parsedOutput.passedOption, 42);
      assert.strictEqual(result.metadata.contentFile, 'out_test.txt');
      assert.strictEqual(result.metadata.numberOfElement, 1);
    });

    it('should transpile and execute Typescript successfully', async () => {
      const transformer = {
        language: 'typescript',
        customCode: `
          // Using TS types
          interface Input { message: string; }
          export default function transform(content: string): unknown {
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
      assert.strictEqual(parsedOutput.response, 'TYPESCRIPT WORKS');
    });

    it('should use the transpilation cache on repeated executions of the same TypeScript transformer', async () => {
      const transformer = {
        language: 'typescript',
        customCode: `
          export default function transform(content: string): unknown {
            return { data: content, filename: 'cached.json' };
          }
        `
      } as CustomTransformer;

      const result1 = await sandboxService.execute('first', defaultSource, 'f1.txt', transformer, {}, logger);
      const result2 = await sandboxService.execute('second', defaultSource, 'f2.txt', transformer, {}, logger);

      assert.strictEqual(result1.output, 'first');
      assert.strictEqual(result2.output, 'second');
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
      assert.strictEqual(JSON.parse(result.output).year, 2026);
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
      assert.deepStrictEqual(JSON.parse(result.output), ['Nigel Rees', 'Evelyn Waugh']);
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
      assert.deepStrictEqual(JSON.parse(result.output), [
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

      const hasMetricsLog = logger.trace.mock.calls.some(
        c =>
          c.arguments[0] !== null &&
          typeof c.arguments[0] === 'object' &&
          String((c.arguments[0] as Record<string, unknown>).msg).includes('Sandbox Execution Metrics')
      );
      assert.ok(hasMetricsLog, 'Expected a trace log with "Sandbox Execution Metrics"');
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

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'syntax-err.txt', transformer, {}, logger),
        /\[RUNTIME_ERROR\]/
      );
    });

    it('should throw if the code does not export a transform function (ReferenceError)', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `const myFunc = () => { return { data: 'ok' }; };`, // Forgot to name it transform
        timeout: 5000
      } as CustomTransformer;

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'no-fn.txt', transformer, {}, logger),
        /\[RUNTIME_ERROR\].*Custom code execution failed: transform is not defined/
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

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'timeout.txt', transformer, {}, logger),
        /\[TIMEOUT_ERROR\]/
      );
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

      assert.ok(
        logger.trace.mock.calls.some(c => c.arguments[0] === 'CUSTOM TRANSFORMER: This is a trace from the sandbox'),
        'Expected trace log from sandbox'
      );
      assert.ok(
        logger.debug.mock.calls.some(c => c.arguments[0] === 'CUSTOM TRANSFORMER: This is a debug from the sandbox'),
        'Expected debug log from sandbox'
      );
      assert.ok(
        logger.debug.mock.calls.some(c => c.arguments[0] === 'CUSTOM TRANSFORMER: This is a log from the sandbox'),
        'Expected log (debug) from sandbox'
      );
      assert.ok(
        logger.info.mock.calls.some(c => c.arguments[0] === 'CUSTOM TRANSFORMER: This is an info from the sandbox'),
        'Expected info log from sandbox'
      );
      assert.ok(
        logger.warn.mock.calls.some(c => c.arguments[0] === 'CUSTOM TRANSFORMER: This is a warning from the sandbox'),
        'Expected warn log from sandbox'
      );
      assert.ok(
        logger.error.mock.calls.some(c => c.arguments[0] === 'CUSTOM TRANSFORMER: This is an error from the sandbox'),
        'Expected error log from sandbox'
      );
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

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger),
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

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger),
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

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'oom.txt', transformer, {}, logger),
        /\[MEMORY_LIMIT_EXCEEDED\]/
      );
    });

    it('should catch TypeScript transpilation errors and map them to SYNTAX_ERROR', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          function transform() {
            throw new Error('TypeScript compilation failed: Invalid syntax');
          }
        `,
        timeout: 5000
      } as CustomTransformer;

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'ts-err.txt', transformer, {}, logger),
        /\[SYNTAX_ERROR\] Custom code execution failed: TypeScript compilation failed/
      );
    });

    it('should throw if the code does not export a transform function (non-function value)', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          var transform = "I am a string, not a function!";
        `,
        timeout: 5000
      } as CustomTransformer;

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger),
        /Custom code must export a "transform" function/
      );
    });

    it('should throw when transform is a non-function value (no timeout)', async () => {
      const transformer = {
        language: 'javascript',
        customCode: `
          var transform = "I am a string, not a function!";
        `
      } as CustomTransformer;

      await assert.rejects(
        async () => sandboxService.execute('', defaultSource, 'err.txt', transformer, {}, logger),
        /Custom code must export a "transform" function/
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: failing heap stats — createContext fails AND getHeapStatisticsSync throws
// ---------------------------------------------------------------------------
describe('SandboxService - failing heap stats', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;

  const logger = new PinoLogger();

  const createContextMock = mock.fn(async () => {
    throw new Error('createContext failed');
  });
  const disposeMock = mock.fn();
  const getHeapStatisticsSync = mock.fn(() => {
    throw new Error('heap stats failed');
  });

  function MockIsolate() {
    return {
      createContext: createContextMock,
      isDisposed: false,
      dispose: disposeMock,
      cpuTime: BigInt(0),
      getHeapStatisticsSync
    };
  }

  const ivmExports = {
    __esModule: true,
    default: {
      Isolate: Object.assign(MockIsolate, { createSnapshot: mock.fn(() => ({})) }),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ExternalCopy: function () {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      Reference: function () {}
    }
  };

  const utilsExports = {
    __esModule: true,
    resolveBypassingExports: mock.fn()
  };

  before(() => {
    mockModule(nodeRequire, 'isolated-vm', ivmExports);
    mockModule(nodeRequire, './utils', utilsExports);
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    createContextMock.mock.resetCalls();
    disposeMock.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    sandboxService = new SandboxService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should silently ignore getHeapStatisticsSync failures in the metrics block', async () => {
    const transformer = { language: 'javascript', customCode: 'function transform() {}' } as CustomTransformer;

    await assert.rejects(
      async () => sandboxService.execute('', { source: 'test' }, 'heap-fail.txt', transformer, {}, logger),
      /\[RUNTIME_ERROR\] Custom code execution failed: createContext failed/
    );

    const hasMetricsLog = logger.trace.mock.calls.some(
      c =>
        c.arguments[0] !== null &&
        typeof c.arguments[0] === 'object' &&
        String((c.arguments[0] as Record<string, unknown>).msg).includes('Sandbox Execution Metrics')
    );
    assert.ok(!hasMetricsLog, 'Expected no "Sandbox Execution Metrics" trace log when heap stats fail');
  });
});

// ---------------------------------------------------------------------------
// Suite: createContext fails — context should remain null (no context.release())
// ---------------------------------------------------------------------------
describe('SandboxService - failing createContext', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;

  const logger = new PinoLogger();

  const createContextMock = mock.fn(async () => {
    throw new Error('createContext failed');
  });
  const disposeMock = mock.fn();
  const getHeapStatisticsSync = mock.fn(() => ({ used_heap_size: 0 }));

  function MockIsolate() {
    return {
      createContext: createContextMock,
      isDisposed: false,
      dispose: disposeMock,
      cpuTime: BigInt(0),
      getHeapStatisticsSync
    };
  }

  const ivmExports = {
    __esModule: true,
    default: {
      Isolate: Object.assign(MockIsolate, { createSnapshot: mock.fn(() => ({})) }),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ExternalCopy: function () {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      Reference: function () {}
    }
  };

  const utilsExports = {
    __esModule: true,
    resolveBypassingExports: mock.fn()
  };

  before(() => {
    mockModule(nodeRequire, 'isolated-vm', ivmExports);
    mockModule(nodeRequire, './utils', utilsExports);
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    createContextMock.mock.resetCalls();
    disposeMock.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    sandboxService = new SandboxService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should skip context.release() when context is null', async () => {
    const transformer = { language: 'javascript', customCode: 'function transform() {}' } as CustomTransformer;

    await assert.rejects(
      async () => sandboxService.execute('', { source: 'test' }, 'null-ctx.txt', transformer, {}, logger),
      /\[RUNTIME_ERROR\] Custom code execution failed: createContext failed/
    );
  });
});
