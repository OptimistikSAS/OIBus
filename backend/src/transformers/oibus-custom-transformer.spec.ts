import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import type OIBusCustomTransformerType from './oibus-custom-transformer';
import { CustomTransformer } from '../model/transformer.model';
import { OIBusTimeValue } from '../../shared/model/engine.model';

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

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockSandboxServiceObj: { execute: ReturnType<typeof mock.fn> };
let OIBusCustomTransformer: typeof OIBusCustomTransformerType;

before(() => {
  mockUtils = { generateRandomId: mock.fn(() => 'randomId') };
  mockSandboxServiceObj = { execute: mock.fn(async () => sandboxOutput) };
  mockModule(nodeRequire, '../service/utils', mockUtils);
  mockModule(nodeRequire, '../service/sandbox.service', {
    __esModule: true,
    default: class MockSandboxService {},
    sandboxService: mockSandboxServiceObj
  });
  const mod = reloadModule<{ default: typeof OIBusCustomTransformerType }>(nodeRequire, './oibus-custom-transformer');
  OIBusCustomTransformer = mod.default;
});

describe('OIBusCustomTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.generateRandomId = mock.fn(() => 'randomId');
    mockSandboxServiceObj.execute = mock.fn(async () => sandboxOutput);
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return sandbox result', async () => {
    const transformer = new OIBusCustomTransformer(logger, testData.transformers.list[0] as CustomTransformer, {});
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 'value1' } },
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_2, data: { value: 'value2', quality: 'good' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ];
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    assert.deepStrictEqual(result, sandboxOutput);
    const args = mockSandboxServiceObj.execute.mock.calls[0].arguments;
    assert.strictEqual(args[0], JSON.stringify(dataChunks));
    assert.deepStrictEqual(args[1], { source: 'test' });
    assert.strictEqual(args[2], 'randomId.json');
    assert.deepStrictEqual(args[3], testData.transformers.list[0]);
    assert.deepStrictEqual(args[4], {});
  });
});
