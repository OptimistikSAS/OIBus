import EngineMetricsService from './engine-metrics.service';

import EngineMetricsRepositoryMock from '../tests/__mocks__/engine-metrics-repository.mock';
import EngineMetricsRepository from '../repository/engine-metrics.repository';
import HomeMetricsService from './home-metrics.service';
import EngineMetricsServiceMock from '../tests/__mocks__/engine-metrics-service.mock';
import { EventEmitter } from 'node:events';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import SouthMetricsRepositoryMock from '../tests/__mocks__/south-metrics-repository.mock';
import NorthMetricsRepositoryMock from '../tests/__mocks__/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';
import SouthConnectorMetricsRepository from '../repository/south-connector-metrics.repository';

jest.mock('./utils');
jest.mock('./oibus.service');

let service: HomeMetricsService;
const engineMetricsService: EngineMetricsService = new EngineMetricsServiceMock();
const engineMetricsRepository: EngineMetricsRepository = new EngineMetricsRepositoryMock();
const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

const northStream = new EventEmitter();
const southStream = new EventEmitter();
const createdSouth = {
  getMetricsDataStream: jest.fn().mockReturnValue(southStream)
};
const createdNorth = {
  getMetricsDataStream: jest.fn().mockReturnValue(northStream)
};
describe('HomeMetrics service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (engineMetricsRepository.getMetrics as jest.Mock).mockReturnValue({});
    service = new HomeMetricsService(
      'id',
      engineMetricsService,
      engineMetricsRepository,
      northConnectorMetricsRepository,
      southConnectorMetricsRepository
    );
  });

  afterEach(() => {
    northStream.removeAllListeners();
    engineMetricsService.stream.removeAllListeners();
    southStream.removeAllListeners();
  });

  it('should update engine metrics', () => {
    engineMetricsService.stream.emit('data', 'data: {}');

    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    engineMetricsService.stream.emit('data', `data: ${JSON.stringify({ engineMetrics: 1 })}`);
    expect(stream.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ norths: {}, engine: { engineMetrics: 1 }, souths: {} })}\n\n`);
    expect(service.stream).toBeDefined();
  });

  it('should add North metrics', () => {
    (northConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({});
    service.addNorth(createdNorth as unknown as NorthConnector, 'id');

    const stream = service.stream;
    stream.write = jest.fn();
    service.addNorth(createdNorth as unknown as NorthConnector, 'id');
    northStream.emit('data', `data: ${JSON.stringify({ northMetrics: 1 })}`);

    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ norths: { id: { northMetrics: 1 } }, engine: {}, souths: {} })}\n\n`
    );
    service.removeNorth('id');
  });

  it('should add South metrics', () => {
    (southConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({});
    service.addSouth(createdSouth as unknown as SouthConnector, 'id');

    const stream = service.stream;
    stream.write = jest.fn();
    service.addSouth(createdSouth as unknown as SouthConnector, 'id');
    southStream.emit('data', `data: ${JSON.stringify({ southMetrics: 1 })}`);

    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ norths: {}, engine: {}, souths: { id: { southMetrics: 1 } } })}\n\n`
    );
    service.removeSouth('id');
  });
});
