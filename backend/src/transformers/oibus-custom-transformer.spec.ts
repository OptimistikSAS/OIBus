import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusPointRecord } from '../../shared/model/common/content.model';

import { CustomTransformer } from '../model/transformer.model';
import type SandboxService from '../service/sandbox.service';
import type * as Utils from '../service/utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type OIBusCustomTransformerType from './oibus-custom-transformer';

const nodeRequire = createRequire(import.meta.url);

const sandboxOutput = {
  output: Buffer.alloc(0),
  metadata: {
    contentFile: '',
    contentSize: 0,
    createdAt: '',
    numberOfElement: 0,
    contentType: '',
    source: { source: 'test' }
  }
};

// Same object for the whole file: the transformer keeps a reference to it, only its `sandboxService` is replaced per test
const sandboxExports: { sandboxService: Mocked<SandboxService> } = { sandboxService: createMock<SandboxService>() };
let OIBusCustomTransformer: typeof OIBusCustomTransformerType;

before(() => {
  const utils = nodeRequire('../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  mockModule(nodeRequire, '../service/sandbox.service', sandboxExports);
  const mod = reloadModule<{ default: typeof OIBusCustomTransformerType }>(nodeRequire, './oibus-custom-transformer');
  OIBusCustomTransformer = mod.default;
});

describe('OIBusCustomTransformer', () => {
  let logger: PinoLogger;
  let transformer: OIBusCustomTransformerType;

  beforeEach(() => {
    logger = new PinoLogger();
    sandboxExports.sandboxService = createMock<SandboxService>({ execute: async () => sandboxOutput });
    transformer = new OIBusCustomTransformer(logger, testData.transformers.list[0] as CustomTransformer, {});
  });

  it('transformInMemory should pass a string directly to runSandbox without re-stringifying', async () => {
    const text = '{"key":"value"}';
    const result = await transformer.transformInMemory(text, { source: 'test' }, 'test.json');
    assert.deepStrictEqual(result, sandboxOutput);
    assert.strictEqual(sandboxExports.sandboxService.execute.mock.calls[0].arguments[0], text);
  });

  it('transformInMemory should JSON.stringify non-string data before calling runSandbox', async () => {
    const data = [{ key: 'value' }];
    await transformer.transformInMemory(data, { source: 'test' }, null);
    assert.strictEqual(sandboxExports.sandboxService.execute.mock.calls[0].arguments[0], JSON.stringify(data));
    assert.strictEqual(sandboxExports.sandboxService.execute.mock.calls[0].arguments[2], 'randomId.json');
  });

  it('should transform data from a stream and return sandbox result', async () => {
    const dataChunks: Array<OIBusPointRecord> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, value: 'value1' },
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_2, value: 'value2', quality: 'good' },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_3, value: 'value1' }
    ];

    const result = await transformer.transform(Readable.from(JSON.stringify(dataChunks)), { source: 'test' }, null);

    assert.deepStrictEqual(result, sandboxOutput);
    const args = sandboxExports.sandboxService.execute.mock.calls[0].arguments;
    assert.strictEqual(args[0], JSON.stringify(dataChunks));
    assert.deepStrictEqual(args[1], { source: 'test' });
    assert.strictEqual(args[2], 'randomId.json');
    assert.deepStrictEqual(args[3], testData.transformers.list[0]);
    assert.deepStrictEqual(args[4], {});
  });

  it('should convert a string sandbox output to a UTF-8 Buffer', async () => {
    sandboxExports.sandboxService.execute.mock.mockImplementation(async () => ({ ...sandboxOutput, output: 'plain text output' }));

    const result = await transformer.transformInMemory('some text', { source: 'test' }, 'test.txt');

    assert.ok(result.output instanceof Buffer);
    assert.strictEqual(result.output.toString('utf8'), 'plain text output');
  });
});
