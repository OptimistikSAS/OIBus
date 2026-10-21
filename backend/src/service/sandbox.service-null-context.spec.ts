import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, beforeEach, describe, it } from 'node:test';

import type { CustomTransformer } from '../model/transformer.model';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import type SandboxServiceClass from './sandbox.service';

const nodeRequire = createRequire(import.meta.url);

// Its own process: isolated-vm is mocked for the whole file, with a createContext that fails.
// ./utils is mocked like in sandbox.service.spec.ts.
const utilsExports = {
  __esModule: true,
  resolveBypassingExports: (pkgName: string, subPath: string) => `/mock/path/${pkgName}/${subPath}`
};

function MockIsolate() {
  return {
    createContext: async () => {
      throw new Error('context creation failed');
    },
    isDisposed: false,
    dispose: () => undefined,
    cpuTime: BigInt(0),
    getHeapStatisticsSync: () => ({ used_heap_size: 0 })
  };
}

describe('SandboxService - null context in finally block', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;
  let logger: PinoLogger;

  before(() => {
    mockModule(nodeRequire, 'isolated-vm', {
      __esModule: true,
      default: { Isolate: Object.assign(MockIsolate, { createSnapshot: () => ({}) }) }
    });
    mockModule(nodeRequire, './utils', utilsExports);
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    sandboxService = new SandboxService();
  });

  it('should handle a null context gracefully when createContext fails', async () => {
    const transformer = { language: 'javascript', customCode: '' } as CustomTransformer;

    await assert.rejects(
      async () => sandboxService.execute('', { source: 'test' }, 'file.txt', transformer, {}, logger),
      /\[RUNTIME_ERROR\] Custom code execution failed: context creation failed/
    );
  });
});
