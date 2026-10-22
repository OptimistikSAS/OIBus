import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { before, beforeEach, describe, it } from 'node:test';

import { OIBusTimeValue } from '../../../../shared/model/common/content.model';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import timeValuesToOpcuaManifest from './manifest';
import type OIBusTimeValuesToOPCUATransformerType from './oibus-time-values-to-opcua-transformer';

const nodeRequire = createRequire(import.meta.url);

let OIBusTimeValuesToOPCUATransformer: typeof OIBusTimeValuesToOPCUATransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToOPCUATransformerType }>(
    nodeRequire,
    './oibus-time-values-to-opcua-transformer'
  );
  OIBusTimeValuesToOPCUATransformer = mod.default;
});

describe('OIBusTimeValuesToOPCUATransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = {
      mapping: [
        { pointId: 'reference1', nodeId: 'ns=3;i=1001' },
        { pointId: 'reference2', nodeId: 'ns=3;i=1002' }
      ]
    };
    const transformer = new OIBusTimeValuesToOPCUATransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: '1' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_2, data: { value: '2', quality: 'good' } },
      { pointId: 'reference3', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(dataChunks)), { source: 'test' }, null);

    assert.deepStrictEqual(result, {
      output: Buffer.from(
        JSON.stringify([
          { nodeId: 'ns=3;i=1001', value: '1' },
          { nodeId: 'ns=3;i=1002', value: '2' }
        ])
      ),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'opcua'
      }
    });
  });

  it('should transform the values of an array or of a JSON string in memory', async () => {
    const transformer = new OIBusTimeValuesToOPCUATransformer(logger, testData.transformers.list[0], {
      mapping: [{ pointId: 'reference1', nodeId: 'ns=1;s=node1' }]
    });
    const values: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: 1 } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_1, data: { value: 2 } }
    ];

    const fromArray = await transformer.transformInMemory(values, { source: 'test' }, null);
    const fromString = await transformer.transformInMemory(JSON.stringify(values), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(fromArray.output.toString()), [{ nodeId: 'ns=1;s=node1', value: 1 }]);
    assert.deepStrictEqual(JSON.parse(fromString.output.toString()), [{ nodeId: 'ns=1;s=node1', value: 1 }]);
    assert.strictEqual(fromArray.metadata.numberOfElement, 1);
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(timeValuesToOpcuaManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [{ type: 'REQUIRED', arguments: [] }],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.title',
            displayProperties: { visible: true, wrapInBox: false },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'pointId',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.point-id',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
              },
              {
                type: 'string',
                key: 'nodeId',
                translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.node-id',
                defaultValue: null,
                validators: [{ type: 'REQUIRED', arguments: [] }],
                displayProperties: { row: 0, columns: 4, displayInViewMode: true }
              }
            ]
          }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false }
    });
  });
});
