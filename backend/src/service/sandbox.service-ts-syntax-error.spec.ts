/**
 * Isolated spec for the TypeScript compilation error path in SandboxService.
 *
 * jest.mock('typescript') must live at the module level, which would break the main spec
 * that relies on the real ts.transpileModule. Hence this dedicated file.
 */

jest.mock('typescript', () => {
  const actual = jest.requireActual<typeof import('typescript')>('typescript');
  return {
    ...actual,
    transpileModule: jest.fn().mockImplementation(() => {
      throw new Error('Unexpected token');
    })
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

describe('SandboxService - TypeScript compilation error', () => {
  let sandboxService: SandboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    sandboxService = new SandboxService();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should catch TypeScript transpilation errors and map them to SYNTAX_ERROR', async () => {
    const transformer = {
      language: 'typescript',
      customCode: `function transform() { const a = ; }`
    } as CustomTransformer;

    await expect(sandboxService.execute('', { source: 'test' }, 'ts-err.txt', transformer, {}, logger)).rejects.toThrow(
      /\[SYNTAX_ERROR\] Sandbox execution failed: TypeScript compilation failed: Unexpected token/
    );
  });
});
