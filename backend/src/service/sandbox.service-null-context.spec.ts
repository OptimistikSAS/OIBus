import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { mockModule, reloadModule, asLogger } from '../tests/utils/test-utils';
import type { CustomTransformer } from '../model/transformer.model';
import type SandboxServiceClass from './sandbox.service';

const nodeRequire = createRequire(import.meta.url);

describe('SandboxService - null context in finally block', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;

  const logger = new PinoLogger();

  const createContextMock = mock.fn(async () => {
    throw new Error('context creation failed');
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

  it('should handle a null context gracefully when createContext fails', async () => {
    const transformer = { language: 'javascript', customCode: '' } as CustomTransformer;

    await assert.rejects(
      async () => sandboxService.execute('', { source: 'test' }, 'file.txt', transformer, {}, asLogger(logger)),
      /\[RUNTIME_ERROR\] Sandbox execution failed: context creation failed/
    );
  });
});
