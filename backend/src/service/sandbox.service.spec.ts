import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { CacheMetadataSource } from '../model/engine.model';
import type { CustomTransformer } from '../model/transformer.model';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import type SandboxServiceClass from './sandbox.service';
// The real singleton, loaded before any mock with the real luxon/jsonpath-plus/papaparse files: production code
// always reaches it through a module mocked in its own spec, so it is exercised only by the last suite below.
import { sandboxService as realSandboxService } from './sandbox.service';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports: the same objects for the whole file
const utilsExports = {
  __esModule: true,
  resolveBypassingExports: (pkgName: string, subPath: string) => `/mock/path/${pkgName}/${subPath}`
};

// Fake library files (luxon / jsonpath-plus / papaparse) read by the SandboxService constructor
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

const buildTransformer = (customCode: string, timeout?: number, language: CustomTransformer['language'] = 'javascript') =>
  ({ language, customCode, timeout }) as CustomTransformer;

const source: CacheMetadataSource = { source: 'test' };

const hasMetricsLog = (logger: PinoLogger) =>
  logger.trace.mock.calls.some(
    c =>
      c.arguments[0] !== null &&
      typeof c.arguments[0] === 'object' &&
      String((c.arguments[0] as Record<string, unknown>).msg).includes('Sandbox Execution Metrics')
  );

let logger: PinoLogger;

before(() => {
  mockModule(nodeRequire, './utils', utilsExports);
});

beforeEach(() => {
  logger = new PinoLogger();
});

afterEach(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Main suite — uses the real isolated-vm, only ./utils and node:fs are mocked
// ---------------------------------------------------------------------------
describe('SandboxService', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;

  before(() => {
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    mock.method(fs, 'readFileSync', fakeReadFileSync);
    sandboxService = new SandboxService();
  });

  describe('Initialization', () => {
    it('should log snapshot created successfully on first execute', async () => {
      const transformer = buildTransformer(`function transform() { return { data: 'ok' }; }`);

      await sandboxService.execute('', source, 'file', transformer, {}, logger);
      const infoMessages: Array<string> = logger.info.mock.calls.map(c => String(c.arguments[0]));
      assert.ok(
        infoMessages.some(m => m.includes('Sandbox snapshot created successfully')),
        'Expected info log containing "Sandbox snapshot created successfully"'
      );
    });

    it('should only log the init message once across multiple executions', async () => {
      const transformer = buildTransformer(`function transform() { return { data: 'ok' }; }`);

      await sandboxService.execute('', source, 'file1', transformer, {}, logger);
      await sandboxService.execute('', source, 'file2', transformer, {}, logger);

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

      await assert.rejects(
        async () => brokenService.execute('test', source, 'file.txt', buildTransformer(''), {}, logger),
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
    it('should execute basic Javascript successfully', async () => {
      const transformer = buildTransformer(
        `
          function transform(content, source, filename, options) {
            return {
              data: { originalContent: content, passedOption: options.myVar },
              filename: 'out_' + filename,
              numberOfElement: 1
            };
          }
        `,
        5000
      );

      const result = await sandboxService.execute('hello world', source, 'test.txt', transformer, { myVar: 42 }, logger);

      const parsedOutput = JSON.parse(result.output as string);
      assert.strictEqual(parsedOutput.originalContent, 'hello world');
      assert.strictEqual(parsedOutput.passedOption, 42);
      assert.strictEqual(result.metadata.contentFile, 'out_test.txt');
      assert.strictEqual(result.metadata.numberOfElement, 1);
    });

    it('should coerce a non-string filename to the fallback so contentFile is always a string', async () => {
      // A custom transformer can return any shape (it runs arbitrary user code). If it returns a
      // non-string filename (e.g. a JSON payload), contentFile must NOT become that object —
      // otherwise it would later be bound to the metrics database and crash better-sqlite3.
      const transformer = buildTransformer(
        `
          function transform(content, source, filename, options) {
            return { data: 'ok', filename: { unexpected: 'json', value: [1, 2, 3] }, numberOfElement: 'not-a-number' };
          }
        `,
        5000
      );

      const result = await sandboxService.execute('payload', source, 'fallback.json', transformer, {}, logger);

      assert.strictEqual(typeof result.metadata.contentFile, 'string');
      assert.strictEqual(result.metadata.contentFile, 'fallback.json');
      assert.strictEqual(result.metadata.numberOfElement, 0);
    });

    it('should transpile and execute Typescript successfully', async () => {
      const transformer = buildTransformer(
        `
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
        5000,
        'typescript'
      );

      const result = await sandboxService.execute(
        JSON.stringify({ message: 'typescript works' }),
        source,
        'test.txt',
        transformer,
        {},
        logger
      );
      const parsedOutput = JSON.parse(result.output as string);
      assert.strictEqual(parsedOutput.response, 'TYPESCRIPT WORKS');
    });

    it('should use the transpilation cache on repeated executions of the same TypeScript transformer', async () => {
      const transformer = buildTransformer(
        `
          export default function transform(content: string): unknown {
            return { data: content, filename: 'cached.json' };
          }
        `,
        undefined,
        'typescript'
      );

      const result1 = await sandboxService.execute('first', source, 'f1.txt', transformer, {}, logger);
      const result2 = await sandboxService.execute('second', source, 'f2.txt', transformer, {}, logger);

      assert.strictEqual(result1.output, 'first');
      assert.strictEqual(result2.output, 'second');
    });

    it('should successfully require and use Luxon', async () => {
      const transformer = buildTransformer(
        `
          const { DateTime } = require('luxon');
          function transform(content) {
            const dt = DateTime.fromISO(content);
            return { data: { year: dt.year }, filename: 'out.json' };
          }
        `,
        5000
      );

      const result = await sandboxService.execute('2026-01-01', source, 'test.txt', transformer, {}, logger);
      assert.strictEqual(JSON.parse(result.output as string).year, 2026);
    });

    it('should successfully require and use JSONPath-Plus', async () => {
      const transformer = buildTransformer(
        `
          const { JSONPath } = require('jsonpath-plus');
          function transform() {
            const results = JSONPath({ path: '$.store.book[*].author', json: {} });
            return { data: results, filename: 'out.json' };
          }
        `,
        5000
      );

      const result = await sandboxService.execute('{}', source, 'test.txt', transformer, {}, logger);
      assert.deepStrictEqual(JSON.parse(result.output as string), ['Nigel Rees', 'Evelyn Waugh']);
    });

    it('should successfully require and use PapaParse', async () => {
      const transformer = buildTransformer(
        `
          const Papa = require('papaparse');
          function transform() {
            const result = Papa.parse('name,age');
            return { data: result.data, filename: 'out.json' };
          }
        `,
        5000
      );

      const result = await sandboxService.execute('', source, 'test.txt', transformer, {}, logger);
      assert.deepStrictEqual(JSON.parse(result.output as string), [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' }
      ]);
    });

    it('should log execution metrics on success', async () => {
      const transformer = buildTransformer(`function transform() { return { data: 'ok', filename: 'f.json' }; }`, 5000);

      await sandboxService.execute('', source, 'metrics.txt', transformer, {}, logger);

      assert.ok(hasMetricsLog(logger), 'Expected a trace log with "Sandbox Execution Metrics"');
    });
  });

  describe('Execution (Error Handling)', () => {
    it('should catch syntax errors', async () => {
      const transformer = buildTransformer(`this is not valid javascript !!!`, 5000);

      await assert.rejects(async () => sandboxService.execute('', source, 'syntax-err.txt', transformer, {}, logger), /\[RUNTIME_ERROR\]/);
    });

    it('should throw if the code does not export a transform function (ReferenceError)', async () => {
      // Forgot to name it transform
      const transformer = buildTransformer(`const myFunc = () => { return { data: 'ok' }; };`, 5000);

      await assert.rejects(
        async () => sandboxService.execute('', source, 'no-fn.txt', transformer, {}, logger),
        /\[RUNTIME_ERROR\].*Custom code execution failed: transform is not defined/
      );
    });

    it('should kill the isolate and throw a timeout error on infinite loops', async () => {
      const transformer = buildTransformer(
        `
          function transform() {
            while(true) {}
          }
        `,
        100
      );

      await assert.rejects(async () => sandboxService.execute('', source, 'timeout.txt', transformer, {}, logger), /\[TIMEOUT_ERROR\]/);
    });

    it('should map sandbox console.log to the host logger', async () => {
      const transformer = buildTransformer(
        `
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
        5000
      );

      await sandboxService.execute('', source, 'log.txt', transformer, {}, logger);

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
      const transformer = buildTransformer(
        `
          const fs = require('fs'); // Unauthorized module
          function transform() { return { data: "ok" }; }
        `,
        5000
      );

      await assert.rejects(
        async () => sandboxService.execute('', source, 'err.txt', transformer, {}, logger),
        /Module "fs" is not allowed/
      );
    });

    it('should throw an error when the transform function returns an invalid shape', async () => {
      const transformer = buildTransformer(
        `
          function transform() {
            return { wrongKey: "missing data property" };
          }
        `,
        5000
      );

      await assert.rejects(
        async () => sandboxService.execute('', source, 'err.txt', transformer, {}, logger),
        /Transform function returned an invalid or empty result/
      );
    });

    it('should JSON-serialize non-string data returned by the transform', async () => {
      const transformer = buildTransformer(`function transform() { return { data: [{ a: 1 }, { b: 2 }], filename: 'out.json' }; }`, 5000);

      const result = await sandboxService.execute('', source, 'arr.txt', transformer, {}, logger);
      assert.strictEqual(typeof result.output, 'string');
      assert.deepStrictEqual(JSON.parse(result.output as string), [{ a: 1 }, { b: 2 }]);
    });

    it('should fail with a clear error when data cannot be serialized to a string (function)', async () => {
      const transformer = buildTransformer(`function transform() { return { data: function () {}, filename: 'out.json' }; }`, 5000);

      await assert.rejects(
        async () => sandboxService.execute('', source, 'fn.txt', transformer, {}, logger),
        /could not be serialized to a string/
      );
    });

    it('should write a Uint8Array data as raw bytes (binary output)', async () => {
      const transformer = buildTransformer(
        `function transform() { return { data: new Uint8Array([72, 105, 0, 255]), filename: 'out.bin' }; }`,
        5000
      );

      const result = await sandboxService.execute('', source, 'bin.txt', transformer, {}, logger);
      assert.deepStrictEqual([...Buffer.from(result.output as ArrayBuffer)], [72, 105, 0, 255]);
    });

    it('should preserve the exact bytes of a non-uint8 typed array', async () => {
      // Int16Array([256, 1]) little-endian bytes: 256 -> [0,1], 1 -> [1,0]
      const transformer = buildTransformer(
        `function transform() { return { data: new Int16Array([256, 1]), filename: 'out.bin' }; }`,
        5000
      );

      const result = await sandboxService.execute('', source, 'bin.txt', transformer, {}, logger);
      assert.deepStrictEqual([...Buffer.from(result.output as ArrayBuffer)], [0, 1, 1, 0]);
    });

    it('should write an ArrayBuffer data as raw bytes', async () => {
      const transformer = buildTransformer(
        `function transform() { return { data: new Uint8Array([1, 2, 3]).buffer, filename: 'out.bin' }; }`,
        5000
      );

      const result = await sandboxService.execute('', source, 'bin.txt', transformer, {}, logger);
      assert.deepStrictEqual([...Buffer.from(result.output as ArrayBuffer)], [1, 2, 3]);
    });

    it('should fail with a clear error when data is a circular structure', async () => {
      const transformer = buildTransformer(
        `function transform() { const o = {}; o.self = o; return { data: o, filename: 'out.json' }; }`,
        5000
      );

      await assert.rejects(async () => sandboxService.execute('', source, 'circular.txt', transformer, {}, logger), /\[RUNTIME_ERROR\]/);
    });

    it('should catch out-of-memory errors and map them to MEMORY_LIMIT_EXCEEDED', async () => {
      const transformer = buildTransformer(
        `
          function transform() {
            const hugeArray = [];
            // Intentionally crash the 256MB V8 heap: arrays of small integers fill it fastest (a typed
            // array would fail its allocation outside of the heap instead)
            while(true) {
              hugeArray.push(new Array(10000000).fill(0));
            }
          }
        `,
        // Large timeout so OOM always fires before the timer; 256MB heap exhausts in <5s
        60000
      );

      await assert.rejects(async () => sandboxService.execute('', source, 'oom.txt', transformer, {}, logger), /\[MEMORY_LIMIT_EXCEEDED\]/);
    });

    it('should throw if the code does not export a transform function (non-function value)', async () => {
      const transformer = buildTransformer(`var transform = "I am a string, not a function!";`, 5000);

      await assert.rejects(
        async () => sandboxService.execute('', source, 'err.txt', transformer, {}, logger),
        /Custom code must export a "transform" function/
      );
    });

    it('should throw when transform is a non-function value (no timeout)', async () => {
      const transformer = buildTransformer(`var transform = "I am a string, not a function!";`);

      await assert.rejects(
        async () => sandboxService.execute('', source, 'err.txt', transformer, {}, logger),
        /Custom code must export a "transform" function/
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: mocked typescript whose transpileModule throws (the real one reports syntax errors as diagnostics
// instead of throwing). Uses the real isolated-vm, like the main suite.
// ---------------------------------------------------------------------------
describe('SandboxService - TypeScript compilation error', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;
  const realTypescript: unknown = nodeRequire('typescript');

  before(() => {
    mockModule(nodeRequire, 'typescript', {
      __esModule: true,
      default: {
        ...(realTypescript as object),
        transpileModule: () => {
          throw new Error('Unexpected token');
        }
      }
    });
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  after(() => {
    mockModule(nodeRequire, 'typescript', realTypescript);
  });

  beforeEach(() => {
    mock.method(fs, 'readFileSync', fakeReadFileSync);
    sandboxService = new SandboxService();
  });

  it('should catch TypeScript transpilation errors and map them to SYNTAX_ERROR', async () => {
    const transformer = buildTransformer(`function transform() { const a = ; }`, undefined, 'typescript');

    await assert.rejects(
      async () => sandboxService.execute('', source, 'ts-err.txt', transformer, {}, logger),
      new Error('[SYNTAX_ERROR] Custom code execution failed: TypeScript compilation failed: Unexpected token')
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: mocked isolated-vm whose createContext fails — context stays null (no context.release())
// ---------------------------------------------------------------------------
describe('SandboxService - failing createContext', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;
  let getHeapStatisticsSync: () => unknown;

  function MockIsolate() {
    return {
      createContext: async () => {
        throw new Error('createContext failed');
      },
      isDisposed: false,
      dispose: () => undefined,
      cpuTime: BigInt(0),
      getHeapStatisticsSync: () => getHeapStatisticsSync()
    };
  }

  before(() => {
    mockModule(nodeRequire, 'isolated-vm', {
      __esModule: true,
      default: { Isolate: Object.assign(MockIsolate, { createSnapshot: () => ({}) }) }
    });
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    getHeapStatisticsSync = () => ({ used_heap_size: 0 });
    sandboxService = new SandboxService();
  });

  it('should skip context.release() when context is null', async () => {
    const transformer = buildTransformer('function transform() {}');

    await assert.rejects(
      async () => sandboxService.execute('', source, 'null-ctx.txt', transformer, {}, logger),
      /\[RUNTIME_ERROR\] Custom code execution failed: createContext failed/
    );
  });

  it('should silently ignore getHeapStatisticsSync failures in the metrics block', async () => {
    getHeapStatisticsSync = () => {
      throw new Error('heap stats failed');
    };
    const transformer = buildTransformer('function transform() {}');

    await assert.rejects(
      async () => sandboxService.execute('', source, 'heap-fail.txt', transformer, {}, logger),
      /\[RUNTIME_ERROR\] Custom code execution failed: createContext failed/
    );

    assert.ok(!hasMetricsLog(logger), 'Expected no "Sandbox Execution Metrics" trace log when heap stats fail');
  });
});

// ---------------------------------------------------------------------------
// Suite: the real exported singleton, built at module-load time with the real
// luxon / jsonpath-plus / papaparse library files (no mocking at all).
// ---------------------------------------------------------------------------
describe('SandboxService - real exported singleton', () => {
  it('should execute a transform with the real, production sandboxService singleton', async () => {
    const transformer = buildTransformer(
      `
        const { DateTime } = require('luxon');
        function transform(content) {
          return { data: { valid: DateTime.fromISO(content).isValid }, filename: 'real.json' };
        }
      `,
      5000
    );

    const result = await realSandboxService.execute('2026-01-01', source, 'real.txt', transformer, {}, logger);

    const parsed = JSON.parse(result.output as string);
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(result.metadata.contentFile, 'real.json');
  });
});
