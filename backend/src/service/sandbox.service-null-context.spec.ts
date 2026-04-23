/**
 * Isolated spec for the null-context branch in SandboxService.execute()'s finally block.
 *
 * jest.mock('isolated-vm') must live at the module level, which would break the main spec
 * that relies on the real ivm implementation. Hence this dedicated file.
 */

jest.mock('isolated-vm', () => {
  const MockIsolate = jest.fn().mockImplementation(() => ({
    createContext: jest.fn().mockRejectedValue(new Error('context creation failed')),
    isDisposed: false,
    dispose: jest.fn(),
    cpuTime: BigInt(0),
    getHeapStatisticsSync: jest.fn().mockReturnValue({ used_heap_size: 0 })
  }));
  (MockIsolate as any).createSnapshot = jest.fn().mockReturnValue({});

  return {
    Isolate: MockIsolate,
    ExternalCopy: jest.fn(),
    Reference: jest.fn()
  };
});

jest.mock('./utils', () => ({
  resolveBypassingExports: jest.fn()
}));
jest.mock('node:fs');

import SandboxService from './sandbox.service';
import * as fs from 'node:fs';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { CustomTransformer } from '../model/transformer.model';

const logger: pino.Logger = new PinoLogger();

describe('SandboxService - null context in finally block', () => {
  let sandboxService: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    sandboxService = new SandboxService();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should handle a null context gracefully when createContext fails', async () => {
    const transformer = { language: 'javascript', customCode: '' } as CustomTransformer;

    await expect(sandboxService.execute('', { source: 'test' }, 'file.txt', transformer, {}, logger)).rejects.toThrow(
      '[RUNTIME_ERROR] Custom code execution failed: context creation failed'
    );
  });
});
