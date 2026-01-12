import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import { OIBusSetpoint } from '../../../../shared/model/engine.model';
import csv from 'papaparse';
import OIBusSetpointToMQTTTransformer from './oibus-setpoint-to-mqtt-transformer';

jest.mock('../../../service/utils', () => ({
  generateRandomId: jest.fn().mockReturnValue('randomId')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusSetpointToMQTTTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      mapping: [
        { reference: 'reference1', topic: '/oibus/reference1' },
        { reference: 'reference2', topic: '/oibus/reference2' }
      ]
    };
    // Arrange
    const transformer = new OIBusSetpointToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
    const source = 'test-source';
    const dataChunks: Array<OIBusSetpoint> = [
      {
        reference: 'reference1',
        value: 1
      },
      {
        reference: 'reference2',
        value: '2'
      },
      {
        reference: 'reference3',
        value: 'value1'
      }
    ];

    // Mock Readable stream
    const mockStream = new Readable();

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: JSON.stringify([
        { topic: '/oibus/reference1', payload: '1' },
        { topic: '/oibus/reference2', payload: '2' }
      ]),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 2,
        contentType: 'mqtt'
      }
    });
  });

  it('should return manifest', () => {
    expect(OIBusSetpointToMQTTTransformer.manifestSettings).toEqual({
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'array',
          key: 'mapping',
          translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.title',
          paginate: true,
          numberOfElementPerPage: 20,
          validators: [],
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.title',
            displayProperties: {
              visible: true,
              wrapInBox: false
            },
            enablingConditions: [],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'reference',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.reference',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 6,
                  displayInViewMode: true
                }
              },
              {
                type: 'string',
                key: 'topic',
                translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-mqtt.mapping.topic',
                defaultValue: null,
                validators: [
                  {
                    type: 'REQUIRED',
                    arguments: []
                  }
                ],
                displayProperties: {
                  row: 0,
                  columns: 6,
                  displayInViewMode: true
                }
              }
            ]
          }
        }
      ],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    });
  });
});
