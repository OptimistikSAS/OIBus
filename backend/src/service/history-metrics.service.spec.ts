import { HistoryMetrics } from '../../../shared/model/engine.model';
import HistoryMetricsService from './history-metrics.service';
import SouthConnectorMetricsRepository from '../repository/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/south-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/north-metrics-repository.mock';

const southRepositoryMock: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northRepositoryMock: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: HistoryMetricsService;

describe('HistoryMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    service = new HistoryMetricsService('connectorId', southRepositoryMock, northRepositoryMock);
  });

  it('should get stream', () => {
    const metrics: HistoryMetrics = {
      north: {
        metricsStart: nowDateString,
        numberOfValuesSent: 0,
        numberOfFilesSent: 0,
        lastValueSent: null,
        lastFileSent: null,
        lastConnection: null,
        lastRunStart: null,
        lastRunDuration: null,
        cacheSize: 0
      },
      south: {
        metricsStart: nowDateString,
        numberOfValuesRetrieved: 0,
        numberOfFilesRetrieved: 0,
        lastValueRetrieved: null,
        lastFileRetrieved: null,
        lastConnection: null,
        lastRunStart: null,
        lastRunDuration: null,
        historyMetrics: {}
      }
    };
    service.updateMetrics(metrics as HistoryMetrics);
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    expect(stream.write).toHaveBeenCalledWith(`data: ${JSON.stringify(metrics)}\n\n`);

    service.updateMetrics({
      south: {
        numberOfValuesRetrieved: 22,
        numberOfFilesRetrieved: 33
      },
      north: {
        numberOfValuesSent: 22,
        numberOfFilesSent: 33
      }
    } as HistoryMetrics);
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        south: {
          numberOfValuesRetrieved: 22,
          numberOfFilesRetrieved: 33
        },
        north: {
          numberOfValuesSent: 22,
          numberOfFilesSent: 33
        }
      })}\n\n`
    );

    service.metrics;
    service.stream;
  });
});
