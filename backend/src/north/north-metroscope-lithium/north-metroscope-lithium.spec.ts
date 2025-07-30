jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/http-request.utils');

import fs from 'node:fs/promises';
import NorthMetroscopeLithium from './north-metroscope-lithium';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthMetroscopeLithiumSettings } from '../../../shared/model/north-settings.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import testData from '../../tests/utils/test-data';
import { HTTPRequest, ReqProxyOptions, ReqResponse, retryableHttpStatusCodes } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import { OIBusError } from '../../model/engine.model';
import { mockBaseFolders } from '../../tests/utils/test-utils';

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();

let north: NorthMetroscopeLithium;
let configuration: NorthConnectorEntity<NorthMetroscopeLithiumSettings>;

const endpoint = 'https://lithium.metroscope.io/api/open/import';
const settings: NorthMetroscopeLithiumSettings = {
  endpoint,
  apiKey: 'test-api-key',
  sourceId: 'oibus',
  group: 'cycle',
  label: 'test-label',
  timeout: 30,
  useProxy: false
};

const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'Power',
    timestamp: '2025-07-30T14:24:37.000Z',
    data: { value: '5000', quality: 'good' }
  },
  {
    pointId: 'chiller_power_chiller_101',
    timestamp: '2025-07-30T14:24:37.000Z',
    data: { value: '3000', quality: 'good' }
  },
  {
    pointId: 'Temperature',
    timestamp: '2025-07-30T14:25:37.000Z',
    data: { value: '25.5', quality: 'good' }
  }
];

describe('NorthMetroscopeLithium', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    configuration = {
      ...testData.north.list[0],
      settings
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));

    north = new NorthMetroscopeLithium(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();
  });

  it('should be able to test the connection', async () => {
    const expectedReqOptions = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        APIKEY: 'test-api-key'
      },
      body: JSON.stringify({
        sourceId: 'oibus',
        snapshots: []
      }),
      timeout: 30000
    };

    await north.testConnection();

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(endpoint), expectedReqOptions);
  });

  it('should manage timeout error on test connection', async () => {
    (HTTPRequest as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(north.testConnection()).rejects.toThrow(`Failed to reach Metroscope Lithium endpoint ${endpoint}; message: Timeout error`);

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should manage bad response on test connection', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(401, 'Unauthorized'));

    await expect(north.testConnection()).rejects.toThrow(
      new OIBusError('HTTP request failed with status code 401 and message: "Unauthorized"', false)
    );

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should handle time values', async () => {
    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 3,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    const expectedPayload = {
      sourceId: 'oibus',
      snapshots: [
        {
          date: '2025-07-30T14:24:37.000Z',
          acquisitionStartDate: '2025-07-30T14:24:37.000Z',
          acquisitionEndDate: '2025-07-30T14:24:37.000Z',
          group: 'cycle',
          label: 'test-label',
          sensorValues: [
            {
              sensorTag: 'Power',
              mean: 5000
            },
            {
              sensorTag: 'chiller_power_chiller_101',
              mean: 3000
            }
          ]
        },
        {
          date: '2025-07-30T14:25:37.000Z',
          acquisitionStartDate: '2025-07-30T14:25:37.000Z',
          acquisitionEndDate: '2025-07-30T14:25:37.000Z',
          group: 'cycle',
          label: 'test-label',
          sensorValues: [
            {
              sensorTag: 'Temperature',
              mean: 25.5
            }
          ]
        }
      ]
    };

    const expectedReqOptions = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        APIKEY: 'test-api-key'
      },
      body: JSON.stringify(expectedPayload),
      timeout: 30000
    };

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(endpoint), expectedReqOptions);
  });

  it('should handle values with empty label', async () => {
    configuration.settings.label = null;
    await north.start(); // Reload config

    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 3,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    const expectedPayload = expect.objectContaining({
      snapshots: expect.arrayContaining([
        expect.objectContaining({
          label: ''
        })
      ])
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      new URL(endpoint),
      expect.objectContaining({
        body: expect.stringContaining('"label":""')
      })
    );
  });

  it('should skip non-numeric values', async () => {
    const invalidValues: Array<OIBusTimeValue> = [
      {
        pointId: 'Power',
        timestamp: '2025-07-30T14:24:37.000Z',
        data: { value: 'not-a-number', quality: 'good' }
      },
      {
        pointId: 'Temperature',
        timestamp: '2025-07-30T14:24:37.000Z',
        data: { value: '25.5', quality: 'good' }
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(invalidValues));

    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 2,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    const expectedPayload = {
      sourceId: 'oibus',
      snapshots: [
        {
          date: '2025-07-30T14:24:37.000Z',
          acquisitionStartDate: '2025-07-30T14:24:37.000Z',
          acquisitionEndDate: '2025-07-30T14:24:37.000Z',
          group: 'cycle',
          label: 'test-label',
          sensorValues: [
            {
              sensorTag: 'Temperature',
              mean: 25.5
            }
          ]
        }
      ]
    };

    expect(HTTPRequest).toHaveBeenCalledWith(
      new URL(endpoint),
      expect.objectContaining({
        body: JSON.stringify(expectedPayload)
      })
    );
  });

  it('should handle empty values gracefully', async () => {
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify([]));

    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    // Should not make HTTP request for empty values
    expect(HTTPRequest).not.toHaveBeenCalled();
  });

  it('should validate and format timestamps to ISO 8601', async () => {
    const valuesWithDifferentTimestamps: Array<OIBusTimeValue> = [
      {
        pointId: 'Power',
        timestamp: '2025-07-30T14:24:37Z', // Missing milliseconds
        data: { value: '5000', quality: 'good' }
      },
      {
        pointId: 'Temperature',
        timestamp: '2025-07-30T14:24:37.123Z', // Already ISO 8601
        data: { value: '25.5', quality: 'good' }
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(valuesWithDifferentTimestamps));

    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 2,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    // Should normalize timestamps to ISO 8601 format
    const expectedPayload = {
      sourceId: 'oibus',
      snapshots: [
        {
          date: '2025-07-30T14:24:37.000Z', // Normalized
          acquisitionStartDate: '2025-07-30T14:24:37.000Z',
          acquisitionEndDate: '2025-07-30T14:24:37.000Z',
          group: 'cycle',
          label: 'test-label',
          sensorValues: [
            {
              sensorTag: 'Power',
              mean: 5000
            }
          ]
        },
        {
          date: '2025-07-30T14:24:37.123Z', // Already valid
          acquisitionStartDate: '2025-07-30T14:24:37.123Z',
          acquisitionEndDate: '2025-07-30T14:24:37.123Z',
          group: 'cycle',
          label: 'test-label',
          sensorValues: [
            {
              sensorTag: 'Temperature',
              mean: 25.5
            }
          ]
        }
      ]
    };

    expect(HTTPRequest).toHaveBeenCalledWith(
      new URL(endpoint),
      expect.objectContaining({
        body: JSON.stringify(expectedPayload)
      })
    );
  });

  it('should reject invalid timestamps', async () => {
    const valuesWithInvalidTimestamp: Array<OIBusTimeValue> = [
      {
        pointId: 'Power',
        timestamp: 'invalid-timestamp',
        data: { value: '5000', quality: 'good' }
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(valuesWithInvalidTimestamp));

    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('Invalid timestamp format: invalid-timestamp. Expected ISO 8601 format.', false));

    expect(HTTPRequest).not.toHaveBeenCalled();
  });

  it('should properly throw fetch error with time values', async () => {
    (HTTPRequest as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 3,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; message: Network error`, true));

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should properly throw error on bad response without retrying', async () => {
    // 400 error should not be retried
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'Bad Request'));

    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 3,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 400 and message: "Bad Request"', false));

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should properly throw error on bad response with retrying', async () => {
    // 502 error should be retried
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(502, 'Bad Gateway'));

    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 3,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 502 and message: "Bad Gateway"', true));

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should reject raw files', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('Metroscope Lithium connector only supports time values, not raw files', false));

    expect(HTTPRequest).not.toHaveBeenCalled();
  });

  describe('with proxy', () => {
    beforeEach(async () => {
      configuration.settings = {
        ...settings,
        useProxy: true,
        proxyUrl: 'http://localhost:8080',
        proxyUsername: 'proxy-user',
        proxyPassword: 'proxy-password'
      };
      await north.start(); // Reload config
    });

    it('should use proxy when configured', async () => {
      await north.testConnection();

      const expectedReqOptions = {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          APIKEY: 'test-api-key'
        },
        body: JSON.stringify({
          sourceId: 'oibus',
          snapshots: []
        }),
        proxy: {
          url: 'http://localhost:8080',
          auth: {
            type: 'basic',
            username: 'proxy-user',
            password: 'proxy-password'
          }
        },
        timeout: 30000
      };

      expect(HTTPRequest).toHaveBeenCalledWith(new URL(endpoint), expectedReqOptions);
    });

    it('should throw error when proxy url is not defined', async () => {
      configuration.settings.proxyUrl = undefined;
      await north.start(); // Reload config

      await expect(
        north.handleContent({
          contentFile: '/path/to/file/example-123.json',
          contentSize: 1234,
          numberOfElement: 3,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'time-values',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; message: Proxy URL not specified`, true));
    });
  });

  describe('error message handling', () => {
    class ErrorWithCode extends Error {
      constructor(
        message: string,
        public readonly code: number
      ) {
        super(message);
      }
    }

    it('should properly get message from generic Error', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('generic error object'));

      await expect(
        north.handleContent({
          contentFile: '/path/to/file/example-123.json',
          contentSize: 1234,
          numberOfElement: 3,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'time-values',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; message: generic error object`, true));
    });

    it('should properly get message from non Errors', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue({ some: 'data' });

      await expect(
        north.handleContent({
          contentFile: '/path/to/file/example-123.json',
          contentSize: 1234,
          numberOfElement: 3,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'time-values',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; {"some":"data"}`, true));
    });

    it('should properly get message from Error with code', async () => {
      const error = new ErrorWithCode('error with code', 1);
      (HTTPRequest as jest.Mock).mockRejectedValue(error);

      await expect(
        north.handleContent({
          contentFile: '/path/to/file/example-123.json',
          contentSize: 1234,
          numberOfElement: 3,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'time-values',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; message: error with code, code: 1`, true));
    });

    it('should properly get message from AggregateError', async () => {
      const error1 = new ErrorWithCode('error with code 1', 1);
      const error2 = new ErrorWithCode('error with code 2', 2);
      (HTTPRequest as jest.Mock).mockRejectedValue(new AggregateError([error1, error2]));

      await expect(
        north.handleContent({
          contentFile: '/path/to/file/example-123.json',
          contentSize: 1234,
          numberOfElement: 3,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'time-values',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(
        new OIBusError(
          `Failed to reach Metroscope Lithium endpoint ${endpoint}; message: error with code 1, code: 1; message: error with code 2, code: 2`,
          true
        )
      );
    });
  });
});
