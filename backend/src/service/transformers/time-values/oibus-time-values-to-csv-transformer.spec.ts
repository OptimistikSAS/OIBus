import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import OIBusTimeValuesToCsvTransformer from './oibus-time-values-to-csv-transformer';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
import csv from 'papaparse';

jest.mock('../../utils', () => ({
  formatInstant: jest.fn().mockImplementation(value => value),
  convertDelimiter: jest.fn().mockReturnValue(';')
}));
jest.mock('papaparse');

const logger: pino.Logger = new PinoLogger();

describe('OIBusTimeValuesToCsvTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('should transform data from a stream and return metadata', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: '@CurrentDate.csv',
      delimiter: 'SEMI_COLON',
      compression: false,
      pointIdColumnTitle: 'Reference',
      valueColumnTitle: 'Value',
      timestampColumnTitle: 'Timestamp',
      timestampType: 'string',
      timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      timezone: 'Europe/Paris'
    };

    // Arrange
    const transformer = new OIBusTimeValuesToCsvTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
    const source = 'test-source';
    const dataChunks: Array<OIBusTimeValue> = [
      {
        pointId: 'reference1',
        timestamp: testData.constants.dates.DATE_1,
        data: {
          value: 'value1'
        }
      },
      {
        pointId: 'reference1',
        timestamp: testData.constants.dates.DATE_2,
        data: {
          value: 'value2',
          quality: 'good'
        }
      },
      {
        pointId: 'reference2',
        timestamp: testData.constants.dates.DATE_3,
        data: {
          value: 'value1'
        }
      }
    ];

    // Mock Readable stream
    const mockStream = new Readable();

    // Act
    const promise = transformer.transform(mockStream, source, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;
    // Assert
    expect(result).toEqual({
      output: 'csv content',
      metadata: {
        contentFile: '2021_01_02_00_00_00_000.csv',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any',
        source,
        options: {}
      }
    });
  });

  it('should return manifest', () => {
    expect(OIBusTimeValuesToCsvTransformer.manifestSettings).toEqual({
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [
        {
          type: 'string',
          key: 'filename',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.filename',
          defaultValue: '@CurrentDate.csv',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: false
          }
        },
        {
          type: 'string-select',
          key: 'delimiter',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.delimiter',
          defaultValue: 'COMMA',
          selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: false
          }
        },
        {
          type: 'boolean',
          key: 'compression',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.compression',
          defaultValue: false,
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'pointIdColumnTitle',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.point-id',
          defaultValue: 'Reference',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 1,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'valueColumnTitle',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.value',
          defaultValue: 'Value',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 1,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'timestampColumnTitle',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp',
          defaultValue: 'Timestamp',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 1,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string-select',
          key: 'timestampType',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp-type',
          defaultValue: 'string',
          selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 2,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'string',
          key: 'timestampFormat',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp-format',
          defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 2,
            columns: 4,
            displayInViewMode: false
          }
        },
        {
          type: 'timezone',
          key: 'timezone',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timezone',
          defaultValue: 'UTC',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 2,
            columns: 4,
            displayInViewMode: true
          }
        }
      ],
      enablingConditions: [
        {
          referralPathFromRoot: 'timestampType',
          targetPathFromRoot: 'timezone',
          values: ['string']
        },
        {
          referralPathFromRoot: 'timestampType',
          targetPathFromRoot: 'timestampFormat',
          values: ['string']
        }
      ],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    });
  });
});
