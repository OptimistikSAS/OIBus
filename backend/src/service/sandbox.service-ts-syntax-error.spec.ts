import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { CustomTransformer } from '../model/transformer.model';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import type SandboxServiceClass from './sandbox.service';

const nodeRequire = createRequire(import.meta.url);

// Its own process: typescript is mocked for the whole file (the real transpileModule reports syntax errors as
// diagnostics instead of throwing). Uses the real isolated-vm, with empty library files for its snapshot;
// ./utils is mocked like in sandbox.service.spec.ts.
const utilsExports = {
  __esModule: true,
  resolveBypassingExports: (pkgName: string, subPath: string) => `/mock/path/${pkgName}/${subPath}`
};
const typescriptExports = {
  __esModule: true,
  default: {
    ...nodeRequire('typescript'),
    transpileModule: () => {
      throw new Error('Unexpected token');
    }
  }
};

describe('SandboxService - TypeScript compilation error', () => {
  let SandboxService: typeof SandboxServiceClass;
  let sandboxService: SandboxServiceClass;
  let logger: PinoLogger;

  before(() => {
    mockModule(nodeRequire, 'typescript', typescriptExports);
    mockModule(nodeRequire, './utils', utilsExports);
    SandboxService = reloadModule<{ default: typeof SandboxServiceClass }>(nodeRequire, './sandbox.service').default;
  });

  beforeEach(() => {
    mock.method(fs, 'readFileSync', () => '');
    logger = new PinoLogger();
    sandboxService = new SandboxService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should catch TypeScript transpilation errors and map them to SYNTAX_ERROR', async () => {
    const transformer = { language: 'typescript', customCode: `function transform() { const a = ; }` } as CustomTransformer;

    await assert.rejects(
      async () => sandboxService.execute('', { source: 'test' }, 'ts-err.txt', transformer, {}, logger),
      /\[SYNTAX_ERROR\] Custom code execution failed: TypeScript compilation failed: Unexpected token/
    );
  });
});
