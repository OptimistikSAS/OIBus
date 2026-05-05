import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import type { CustomTransformer } from '../model/transformer.model';
import type SandboxServiceClass from './sandbox.service';

const nodeRequire = createRequire(import.meta.url);

describe('SandboxService - TypeScript compilation error', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;

  const logger = new PinoLogger();

  const releaseMock = mock.fn();
  const contextGlobalSetMock = mock.fn(async () => undefined);
  const contextEvalMock = mock.fn(async () => undefined);
  const mockContext = {
    global: { set: contextGlobalSetMock },
    eval: contextEvalMock,
    release: releaseMock
  };

  const createContextMock = mock.fn(async () => mockContext);
  const disposeMock = mock.fn();
  const getHeapStatisticsSync = mock.fn(() => ({ used_heap_size: 0 }));

  function MockIsolate() {
    return {
      createContext: createContextMock,
      compileScript: mock.fn(async () => ({ run: mock.fn(async () => undefined) })),
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

  const tsActual = nodeRequire('typescript');
  const typescriptExports = {
    __esModule: true,
    default: {
      ...tsActual,
      transpileModule: mock.fn(() => {
        throw new Error('Unexpected token');
      })
    }
  };

  before(() => {
    mockModule(nodeRequire, 'isolated-vm', ivmExports);
    mockModule(nodeRequire, 'typescript', typescriptExports);
    mockModule(nodeRequire, './utils', utilsExports);
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    createContextMock.mock.resetCalls();
    disposeMock.mock.resetCalls();
    releaseMock.mock.resetCalls();
    contextGlobalSetMock.mock.resetCalls();
    contextEvalMock.mock.resetCalls();
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

  it('should catch TypeScript transpilation errors and map them to SYNTAX_ERROR', async () => {
    const transformer = {
      language: 'typescript',
      customCode: `function transform() { const a = ; }`
    } as CustomTransformer;

    await assert.rejects(
      async () => sandboxService.execute('', { source: 'test' }, 'ts-err.txt', transformer, {}, logger),
      /\[SYNTAX_ERROR\] Custom code execution failed: TypeScript compilation failed: Unexpected token/
    );
  });
});
